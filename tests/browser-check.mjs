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

const findHeadingCollisions = (page, pairs) => page.evaluate((selectors) => {
  const textBounds = (selector) => {
    const range = document.createRange();
    range.selectNodeContents(document.querySelector(selector));
    const boxes = [...range.getClientRects()];
    return {
      right: Math.max(...boxes.map((box) => box.right)),
      top: Math.min(...boxes.map((box) => box.top)),
      bottom: Math.max(...boxes.map((box) => box.bottom)),
    };
  };
  return Object.fromEntries(Object.entries(selectors).map(([name, [headingSelector, panelSelector]]) => {
    const heading = textBounds(headingSelector);
    const panel = document.querySelector(panelSelector).getBoundingClientRect();
    const collides = heading.top < panel.bottom
      && heading.bottom > panel.top
      && heading.right > panel.left - 8;
    return [name, collides];
  }));
}, pairs);

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
  const desktopHeadingCollisions = await findHeadingCollisions(desktop, {
    install: [".install h2", ".install-terminal"],
    release: [".release h2", ".release-ledger"],
  });
  check(!desktopHeadingCollisions.install, "desktop install heading collides with the terminal");
  check(!desktopHeadingCollisions.release, "desktop release heading collides with the ledger");

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
  const nativeActionCenters = await desktop.locator(".native-preview-actions a").evaluateAll((links) => links.map((link) => {
    const box = link.getBoundingClientRect();
    return box.top + box.height / 2;
  }));
  check(Math.abs(nativeActionCenters[0] - nativeActionCenters[1]) <= 1, "desktop native-preview actions are vertically misaligned");
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

  const narrowContext = await browser.newContext({
    viewport: { width: 320, height: 720 },
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
  });
  const narrow = await narrowContext.newPage();
  watchPage(narrow, "narrow-mobile");
  await narrow.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
  const narrowBounds = await narrow.evaluate(() => {
    const bounds = (selector) => {
      const box = document.querySelector(selector).getBoundingClientRect();
      return { left: box.left, right: box.right, top: box.top, bottom: box.bottom };
    };
    const shell = bounds(".hero .shell");
    const implementation = bounds(".hero h1 em");
    const consoleBox = bounds(".signal-console");
    const ledger = bounds(".release-ledger");
    const releaseShell = bounds(".release .shell");
    const code = document.querySelector(".console-code");
    const closingTitle = document.querySelector(".closing h2");
    return {
      shell,
      implementation,
      consoleBox,
      ledger,
      releaseShell,
      codeOverflow: code.scrollWidth - code.clientWidth,
      closingOverflow: closingTitle.scrollWidth - closingTitle.clientWidth,
    };
  });
  check(narrowBounds.implementation.right <= narrowBounds.shell.right + 1, "320px hero title is clipped");
  check(narrowBounds.consoleBox.right <= narrowBounds.shell.right + 1, "320px signal console exceeds its shell");
  check(narrowBounds.codeOverflow <= 1, "320px signal-console code is horizontally clipped");
  check(narrowBounds.ledger.right <= narrowBounds.releaseShell.right + 1, "320px release ledger exceeds its shell");
  check(narrowBounds.closingOverflow <= 1, "320px closing title is clipped");
  await narrowContext.close();

  const compactDesktopContext = await browser.newContext({
    viewport: { width: 901, height: 900 },
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
  });
  const compactDesktop = await compactDesktopContext.newPage();
  watchPage(compactDesktop, "compact-desktop");
  await compactDesktop.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
  const compactCollisions = await findHeadingCollisions(compactDesktop, {
    hero: [".hero h1 em", ".signal-console"],
  });
  check(!compactCollisions.hero, "901px hero title collides with the signal console");
  await compactDesktopContext.close();

  const wideContext = await browser.newContext({
    viewport: { width: 1920, height: 1000 },
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
  });
  const wide = await wideContext.newPage();
  watchPage(wide, "wide-desktop");
  await wide.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
  const wideHeadingCollisions = await findHeadingCollisions(wide, {
    hero: [".hero h1", ".signal-console"],
    install: [".install h2", ".install-terminal"],
    release: [".release h2", ".release-ledger"],
  });
  check(!wideHeadingCollisions.hero, "wide-desktop hero title collides with the signal console");
  check(!wideHeadingCollisions.install, "wide-desktop install heading collides with the terminal");
  check(!wideHeadingCollisions.release, "wide-desktop release heading collides with the ledger");
  await wideContext.close();

  const noScriptContext = await browser.newContext({
    viewport: { width: 320, height: 720 },
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
  const noScriptLayout = await noScript.evaluate(() => {
    const header = document.querySelector(".site-header").getBoundingClientRect();
    const brand = document.querySelector(".site-header .brand").getBoundingClientRect();
    const navigationBox = document.querySelector("#site-nav").getBoundingClientRect();
    const releaseChip = document.querySelector(".release-chip").getBoundingClientRect();
    return {
      headerBottom: header.bottom,
      brandBottom: brand.bottom,
      navigationTop: navigationBox.top,
      releaseChipTop: releaseChip.top,
    };
  });
  check(noScriptLayout.brandBottom <= noScriptLayout.navigationTop + 1, "no-script mobile navigation is painted above the brand");
  check(noScriptLayout.headerBottom <= noScriptLayout.releaseChipTop, "no-script mobile header overlaps hero content");
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

console.log("BROWSER CHECK: PASS (1920×1000, 1440×1000, 901×900, 390×844, and 320×720)");
