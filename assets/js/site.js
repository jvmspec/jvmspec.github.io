(() => {
  "use strict";

  const root = document.documentElement;
  root.classList.add("js");

  const header = document.querySelector("[data-site-header]");
  const menuButton = document.querySelector(".menu-toggle");
  const navigation = document.querySelector("#site-nav");
  const mobileQuery = window.matchMedia("(max-width: 720px)");

  const setMenu = (open) => {
    if (!menuButton || !navigation) return;
    menuButton.setAttribute("aria-expanded", String(open));
    navigation.classList.toggle("is-open", open);
  };

  if (menuButton && navigation) {
    menuButton.addEventListener("click", () => {
      setMenu(menuButton.getAttribute("aria-expanded") !== "true");
    });

    navigation.addEventListener("click", (event) => {
      if (event.target.closest("a")) setMenu(false);
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && menuButton.getAttribute("aria-expanded") === "true") {
        setMenu(false);
        menuButton.focus();
      }
    });

    document.addEventListener("click", (event) => {
      if (!mobileQuery.matches || navigation.contains(event.target) || menuButton.contains(event.target)) return;
      setMenu(false);
    });

    mobileQuery.addEventListener?.("change", (event) => {
      if (!event.matches) setMenu(false);
    });
  }

  const updateHeader = () => {
    header?.classList.toggle("is-stuck", window.scrollY > 28);
  };
  updateHeader();
  window.addEventListener("scroll", updateHeader, { passive: true });

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const revealItems = [...document.querySelectorAll(".reveal")];
  if (reduceMotion || !("IntersectionObserver" in window)) {
    revealItems.forEach((item) => item.classList.add("is-visible"));
  } else {
    const revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -8%", threshold: 0.08 });
    revealItems.forEach((item) => revealObserver.observe(item));
  }

  const sectionLinks = [...document.querySelectorAll('.site-nav a[href^="#"]')];
  const sections = sectionLinks
    .map((link) => document.querySelector(link.getAttribute("href")))
    .filter(Boolean);
  if (sections.length && "IntersectionObserver" in window) {
    const sectionObserver = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      sectionLinks.forEach((link) => {
        const current = link.getAttribute("href") === `#${visible.target.id}`;
        if (current) link.setAttribute("aria-current", "true");
        else link.removeAttribute("aria-current");
      });
    }, { rootMargin: "-25% 0px -60%", threshold: [0, 0.1, 0.4] });
    sections.forEach((section) => sectionObserver.observe(section));
  }

  const tabLists = document.querySelectorAll('[role="tablist"]');
  tabLists.forEach((tabList) => {
    const tabs = [...tabList.querySelectorAll('[role="tab"]')];
    const activate = (tab) => {
      tabs.forEach((candidate) => {
        const selected = candidate === tab;
        candidate.setAttribute("aria-selected", String(selected));
        candidate.tabIndex = selected ? 0 : -1;
        const panel = document.getElementById(candidate.getAttribute("aria-controls"));
        if (panel) panel.hidden = !selected;
      });
    };

    tabs.forEach((tab, index) => {
      tab.addEventListener("click", () => activate(tab));
      tab.addEventListener("keydown", (event) => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        let nextIndex = index;
        if (event.key === "ArrowRight") nextIndex = (index + 1) % tabs.length;
        if (event.key === "ArrowLeft") nextIndex = (index - 1 + tabs.length) % tabs.length;
        if (event.key === "Home") nextIndex = 0;
        if (event.key === "End") nextIndex = tabs.length - 1;
        activate(tabs[nextIndex]);
        tabs[nextIndex].focus();
      });
    });
  });

  const fallbackCopy = (text) => {
    const field = document.createElement("textarea");
    field.value = text;
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.opacity = "0";
    document.body.appendChild(field);
    field.select();
    const copied = document.execCommand("copy");
    field.remove();
    if (!copied) throw new Error("Copy command was rejected");
  };

  document.querySelectorAll("[data-copy-target]").forEach((button) => {
    button.addEventListener("click", async () => {
      const target = document.getElementById(button.dataset.copyTarget);
      const status = document.querySelector("[data-copy-status]");
      const label = button.querySelector("[data-copy-label]");
      if (!target) return;
      const text = target.textContent.trim();
      try {
        if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(text);
        else fallbackCopy(text);
        if (label) label.textContent = "Copied";
        if (status) status.textContent = "Snippet copied to clipboard.";
        window.setTimeout(() => {
          if (label) label.textContent = "Copy";
        }, 1800);
      } catch (_error) {
        if (label) label.textContent = "Select";
        if (status) status.textContent = "Copy was unavailable; select the snippet manually.";
      }
    });
  });

  const year = String(new Date().getFullYear());
  document.querySelectorAll("[data-current-year]").forEach((element) => {
    element.textContent = year;
  });
})();
