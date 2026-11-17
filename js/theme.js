"use strict";

// Light and dark mode. This file loads in <head> without defer, so the saved theme is
// applied before the page is painted and there is no flash of the wrong colors.
const THEME_KEY = "gymzone-theme";
const THEME_COLORS = { dark: "#111715", light: "#f6f8f3" };

function readSavedTheme() {
    try {
        const saved = localStorage.getItem(THEME_KEY);
        if (saved === "light" || saved === "dark") return saved;
    } catch {
        // Storage can be blocked (private mode). The system preference is used instead.
    }
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function applyTheme(theme) {
    const root = document.documentElement;
    root.dataset.theme = theme;
    // Bootstrap reads data-bs-theme for its own components (form controls, tooltips).
    root.dataset.bsTheme = theme;
    document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute("content", THEME_COLORS[theme]);

    document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
        const next = theme === "dark" ? "light" : "dark";
        button.setAttribute("aria-pressed", String(theme === "light"));
        button.setAttribute("aria-label", `Switch to ${next} mode`);
        button.title = `Switch to ${next} mode`;
    });
}

applyTheme(readSavedTheme());

document.addEventListener("DOMContentLoaded", () => {
    // Runs again now that the toggle buttons exist, so their labels match the theme.
    applyTheme(document.documentElement.dataset.theme);

    document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
        button.addEventListener("click", () => {
            const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
            applyTheme(next);
            try {
                localStorage.setItem(THEME_KEY, next);
            } catch {
                // The theme still changes for this page if it cannot be saved.
            }
        });
    });
});

// Another open tab changed the theme: follow it.
window.addEventListener("storage", (event) => {
    if (event.key === THEME_KEY && event.newValue) applyTheme(event.newValue);
});
