#!/usr/bin/env node
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import process from "node:process";

const host = "127.0.0.1";
const port = 4173;
const baseUrl = `http://${host}:${port}`;
const failures = [];
const localFailures = [];

const check = (condition, message) => {
  if (!condition) failures.push(message);
};

const server = spawn("python3", ["-m", "http.server", String(port), "--bind", host], {
  cwd: new URL("..", import.meta.url),
  stdio: "ignore",
});

const waitForServer = async () => {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/`, { redirect: "manual" });
      if (response.ok) return;
    } catch (_error) {
      // The server may still be starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Local preview server did not start");
};

const watchPage = (page, label) => {
  page.on("console", (message) => {
    if (message.type() === "error") failures.push(`${label} console error: ${message.text()}`);
  });
  page.on("pageerror", (error) => failures.push(`${label} page error: ${error.message}`));
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (url.origin === baseUrl && response.status() >= 400) {
      localFailures.push(`${response.status()} ${url.pathname}`);
    }
  });
};

let browser;
try {
  await waitForServer();
  await mkdir(new URL("../test-results", import.meta.url), { recursive: true });
  browser = await chromium.launch({ headless: true });

  const desktopContext = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
    reducedMotion: "no-preference",
    permissions: ["clipboard-read", "clipboard-write"],
  });
  const desktop = await desktopContext.newPage();
  watchPage(desktop, "desktop");
  const response = await desktop.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
  check(response?.status() === 200, "desktop home did not return HTTP 200");
  check(await desktop.getByRole("heading", { level: 1, name: /Behavior before implementation/i }).isVisible(), "desktop h1 is not visible");
  check(await desktop.getByRole("link", { name: /Start with RC5/i }).isVisible(), "primary onboarding action is not visible");
  check((await desktop.locator("body").innerText()).includes("1.0.0-RC5"), "RC5 release token is not rendered");

  await desktop.keyboard.press("Tab");
  check(await desktop.evaluate(() => document.activeElement?.classList.contains("skip-link")), "skip link is not the first keyboard focus target");
  await desktop.evaluate(() => document.activeElement?.blur());

  await desktop.getByRole("button", { name: "Copy Maven dependency" }).click();
  await desktop.waitForFunction(() => document.querySelector("[data-copy-status]")?.textContent.length > 0);
  check((await desktop.locator("[data-copy-status]").textContent()).includes("copied"), "copy control did not report success");

  await desktop.getByRole("tab", { name: "CLI" }).click();
  check(await desktop.locator("#panel-cli").isVisible(), "CLI tab panel did not become visible");
  await desktop.getByRole("tab", { name: "Maven" }).click();

  for (const section of ["workflow", "features", "install", "ecosystem", "docs", "release"]) {
    await desktop.locator(`#${section}`).scrollIntoViewIfNeeded();
    await desktop.waitForTimeout(80);
  }
  await desktop.locator(".native-preview-band").scrollIntoViewIfNeeded();
  check(await desktop.getByRole("heading", { level: 3, name: /Link the project/i }).isVisible(), "native preview heading is not visible");
  await desktop.locator(".closing").scrollIntoViewIfNeeded();
  await desktop.waitForTimeout(850);
  await desktop.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    document.documentElement.style.scrollBehavior = "auto";
    window.scrollTo(0, 0);
  });
  await desktop.waitForFunction(() => window.scrollY === 0);
  check(await desktop.locator(".skip-link").evaluate((element) => element.getBoundingClientRect().bottom < 0), "skip link remained visible after losing focus");
  check(await desktop.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "desktop page has horizontal overflow");
  await desktop.screenshot({ path: new URL("../test-results/site-desktop.png", import.meta.url).pathname, fullPage: true });
  await desktopContext.close();

  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
  });
  const mobile = await mobileContext.newPage();
  watchPage(mobile, "mobile");
  await mobile.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
  const menu = mobile.getByRole("button", { name: /Menu/i });
  check(await menu.isVisible(), "mobile menu control is not visible");
  await menu.click();
  check(await menu.getAttribute("aria-expanded") === "true", "mobile menu does not expose expanded state");
  check(await mobile.locator("#site-nav").isVisible(), "mobile navigation did not open");
  await mobile.keyboard.press("Escape");
  check(await menu.getAttribute("aria-expanded") === "false", "Escape did not close the mobile navigation");
  check(await mobile.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "mobile page has horizontal overflow");
  check(await mobile.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior === "auto"), "reduced-motion mode did not disable smooth scrolling");
  await mobile.screenshot({ path: new URL("../test-results/site-mobile.png", import.meta.url).pathname, fullPage: true });
  await mobileContext.close();

  const noScriptContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    javaScriptEnabled: false,
  });
  const noScript = await noScriptContext.newPage();
  watchPage(noScript, "no-script");
  await noScript.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
  check(await noScript.getByRole("heading", { level: 1, name: /Behavior before implementation/i }).isVisible(), "no-script h1 is not visible");
  check(await noScript.locator("#maven-snippet").isVisible(), "no-script Maven onboarding is not visible");
  check((await noScript.locator("body").innerText()).includes("javaspec:native-prepare"), "no-script native preview is unavailable");
  check(await noScript.locator("#site-nav").isVisible(), "no-script mobile navigation is not available");
  check(await noScript.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "no-script mobile page has horizontal overflow");
  await noScriptContext.close();

  const notFoundContext = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  const notFound = await notFoundContext.newPage();
  watchPage(notFound, "404");
  const missingResponse = await notFound.goto(`${baseUrl}/404.html`, { waitUntil: "networkidle" });
  check(missingResponse?.status() === 200, "static 404 document could not be loaded directly");
  check(await notFound.getByRole("heading", { level: 1, name: "Page not found." }).isVisible(), "404 heading is not visible");
  await notFoundContext.close();

  check(localFailures.length === 0, `local asset failures: ${[...new Set(localFailures)].join(", ")}`);
} catch (error) {
  failures.push(error.stack || error.message);
} finally {
  if (browser) await browser.close();
  server.kill("SIGTERM");
}

if (failures.length) {
  console.error("BROWSER CHECK: FAIL");
  failures.forEach((failure) => console.error(` - ${failure}`));
  process.exit(1);
}

console.log("BROWSER CHECK: PASS (1440×1000 and 390×844)");
