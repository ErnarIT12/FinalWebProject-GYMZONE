"use strict";

/*
 * Exercise Library: loads exercises from the public wger API (https://wger.de/api/v2/).
 * No API key is needed. Only exercises with a photo are shown, so a beginner always sees the
 * movement. Results are cached per muscle group while the page is open, and the chosen group
 * and search text are saved in localStorage for the next visit.
 */
const WGER_URL = "https://wger.de/api/v2/exerciseinfo/";
const ENGLISH = 2; // wger language id
const PAGE_SIZE = 12; // cards added by each "Load more"
const BATCH_SIZE = 100; // records requested from the API at a time
const REQUEST_TIMEOUT = 10000;
const LIBRARY_KEY = "gymzone-library";

function initializeLibrary() {
    const results = document.querySelector("#library-results");
    if (!results) return;
    const categoryButtons = [...document.querySelectorAll("[data-category]")];
    const search = document.querySelector("#library-search");
    const status = document.querySelector("#library-status");
    const loading = document.querySelector("#library-loading");
    const errorBox = document.querySelector("#library-error");
    const errorText = document.querySelector("#library-error-text");
    const retry = document.querySelector("#library-retry");
    const more = document.querySelector("#library-more");
    const empty = document.querySelector("#library-empty");

    // The account the cards were drawn for. Save buttons act for this account only.
    let viewerEmail = authStore.currentUser()?.email ?? null;
    const savedState = readStorage(accountKey(LIBRARY_KEY, viewerEmail), {});
    const saved = savedState && typeof savedState === "object" ? savedState : {};
    const cache = new Map(); // category id -> { exercises, shown, next }
    let category = categoryButtons.some((button) => button.dataset.category === saved.category)
        ? saved.category
        : categoryButtons[0].dataset.category;
    let controller = null;
    let lastRequest = null;

    function saveState() {
        writeStorage(accountKey(LIBRARY_KEY, viewerEmail), {
            category,
            query: search.value.trim(),
        });
    }

    function categoryName(id = category) {
        return categoryButtons.find((button) => button.dataset.category === id).textContent.trim();
    }

    // The API returns descriptions as HTML. DOMParser reads them as text only,
    // so no markup from the response is ever inserted into the page.
    function toPlainText(html) {
        const text = new DOMParser().parseFromString(html || "", "text/html").body.textContent;
        return text.replace(/\s+/g, " ").trim();
    }

    // Keeps only the fields the page needs from one API result.
    function simplify(item) {
        const english = item.translations.find((translation) => translation.language === ENGLISH);
        const image = item.images.find((picture) => picture.is_main) ?? item.images[0];
        // Exercises without an English name or a photo are skipped.
        if (!english?.name || !image) return null;
        const muscles = [...item.muscles, ...item.muscles_secondary].map(
            (muscle) => muscle.name_en || muscle.name,
        );
        return {
            id: item.id,
            name: english.name,
            description: toPlainText(english.description),
            category: item.category.name,
            // "none (bodyweight exercise)" becomes "Bodyweight".
            equipment: item.equipment
                .map((tool) => (tool.name.startsWith("none") ? "Bodyweight" : tool.name))
                .join(", "),
            muscles: [...new Set(muscles)].join(", "),
            image: image.thumbnails?.medium || image.image,
        };
    }

    // fetch() with a time limit. A slow network ends with a clear message instead of waiting.
    async function fetchPage(url) {
        controller?.abort();
        const request = new AbortController();
        controller = request;
        const timer = window.setTimeout(() => request.abort("timeout"), REQUEST_TIMEOUT);
        try {
            const response = await fetch(url, { signal: request.signal });
            if (!response.ok)
                throw Object.assign(new Error("HTTP error"), { status: response.status });
            return await response.json();
        } finally {
            window.clearTimeout(timer);
        }
    }

    function setLoading(isLoading) {
        loading.hidden = !isLoading;
        results.setAttribute("aria-busy", String(isLoading));
        more.disabled = isLoading;
        categoryButtons.forEach((button) => {
            button.disabled = isLoading && button.dataset.category !== category;
        });
    }

    function showError(error) {
        let message = "Something went wrong while reading the data. Please try again.";
        // abort("timeout") rejects fetch() with that exact string.
        if (error === "timeout") {
            message = "The request took too long. Check your connection and try again.";
        } else if (!navigator.onLine) {
            message = "You appear to be offline. Check your connection and try again.";
        } else if (error?.name === "TypeError") {
            // fetch() throws a TypeError when the server cannot be reached at all.
            message =
                "The exercise server could not be reached. Check your connection and try again.";
        } else if (error?.status) {
            message = `The exercise server answered with an error (status ${error.status}). Please try again in a moment.`;
        }
        errorText.textContent = message;
        errorBox.hidden = false;
        status.textContent = "Exercises could not be loaded.";
    }

    // Loads the first cards of a category, or the next cards when append is true.
    async function load(append = false) {
        const requestedCategory = category;
        const entry = append
            ? cache.get(category)
            : {
                  exercises: [],
                  shown: 0,
                  next: `${WGER_URL}?language=${ENGLISH}&category=${category}&limit=${BATCH_SIZE}`,
              };
        lastRequest = () => load(append);
        errorBox.hidden = true;
        setLoading(true);
        status.textContent = `Loading ${categoryName()} exercises...`;

        try {
            // About a third of wger exercises have a photo, so batches are requested until
            // there are enough new cards or the category has no more pages.
            while (entry.next && entry.exercises.length < entry.shown + PAGE_SIZE) {
                const data = await fetchPage(entry.next);
                entry.exercises.push(...data.results.map(simplify).filter(Boolean));
                entry.next = data.next;
            }
            entry.shown = Math.min(entry.exercises.length, entry.shown + PAGE_SIZE);
            cache.set(requestedCategory, entry);
            if (requestedCategory === category) render();
        } catch (error) {
            // A newer request replaced this one: nothing to report.
            if (error?.name === "AbortError") return;
            if (requestedCategory === category) showError(error);
        } finally {
            if (requestedCategory === category) setLoading(false);
        }
    }

    // Shown if a photo fails to load, so the card never has an empty or broken image.
    function createPlaceholder(exercise) {
        const placeholder = document.createElement("div");
        placeholder.className = "library-placeholder";
        placeholder.setAttribute("aria-hidden", "true");
        placeholder.innerHTML =
            '<svg viewBox="0 0 24 24"><path d="M3 9v6M6 6v12M18 6v12M21 9v6M6 12h12"></path></svg>';
        const label = document.createElement("span");
        label.textContent = `${exercise.category} · photo unavailable`;
        placeholder.append(label);
        return placeholder;
    }

    function createImage(exercise) {
        const image = document.createElement("img");
        image.className = "card-img-top library-image";
        image.src = exercise.image;
        image.alt = `${exercise.name} demonstration`;
        image.loading = "lazy";
        image.addEventListener("error", () => image.replaceWith(createPlaceholder(exercise)), {
            once: true,
        });
        return image;
    }

    function renderSaveButton(button, exercise) {
        const isSaved = authStore.isFavorite(exercise.id, viewerEmail);
        button.classList.toggle("is-saved", isSaved);
        button.setAttribute("aria-pressed", String(isSaved));
        button.querySelector("span").textContent = isSaved ? "Saved" : "Save";
    }

    function createCard(exercise) {
        const column = document.createElement("div");
        column.className = "col-12 col-sm-6 col-lg-4";
        const card = document.createElement("article");
        card.className = "card bootstrap-card library-card h-100";

        const body = document.createElement("div");
        body.className = "card-body";
        const title = document.createElement("h3");
        title.className = "card-title h5";
        title.textContent = exercise.name;

        const tags = document.createElement("p");
        tags.className = "library-tags";
        for (const text of [exercise.category, exercise.equipment || "Equipment not listed"]) {
            const tag = document.createElement("span");
            tag.textContent = text;
            tags.append(tag);
        }

        const muscles = document.createElement("p");
        muscles.className = "card-text library-muscles";
        muscles.textContent = exercise.muscles
            ? `Muscles: ${exercise.muscles}`
            : "Muscles: not listed";

        body.append(title, tags, muscles);

        if (exercise.description) {
            const details = document.createElement("details");
            details.className = "library-details";
            const summary = document.createElement("summary");
            summary.textContent = "How to do it";
            const text = document.createElement("p");
            text.textContent = exercise.description;
            details.append(summary, text);
            body.append(details);
        }

        const save = document.createElement("button");
        save.type = "button";
        save.className = "btn btn-outline-primary btn-sm save-button";
        save.innerHTML =
            '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z"></path></svg><span>Save</span>';
        save.setAttribute("aria-label", `Save ${exercise.name} to your profile`);
        renderSaveButton(save, exercise);
        save.addEventListener("click", async () => {
            const { id, name, category: group, equipment } = exercise;
            const result = await authStore.toggleFavorite(
                { id, name, category: group, equipment },
                viewerEmail,
            );
            if (result.error === "guest") {
                showToast("Log in to save exercises to your profile.", "error");
                status.innerHTML =
                    'Saving needs an account. <a href="login.html">Log in</a> or <a href="signup.html">sign up</a>.';
                return;
            }
            if (!result.ok) {
                showToast(errorMessage(result.error), "error");
                followSession();
                return;
            }
            renderSaveButton(save, exercise);
            showToast(
                result.saved
                    ? `${name} saved to your profile.`
                    : `${name} removed from your profile.`,
            );
        });
        body.append(save);

        card.append(createImage(exercise), body);
        column.append(card);
        return column;
    }

    // Draws the cards of the current category. A search looks through every loaded exercise.
    function render() {
        const entry = cache.get(category);
        if (!entry) return;
        const query = search.value.trim().toLowerCase();
        const visible = query
            ? entry.exercises.filter((exercise) =>
                  [exercise.name, exercise.equipment, exercise.muscles]
                      .join(" ")
                      .toLowerCase()
                      .includes(query),
              )
            : entry.exercises.slice(0, entry.shown);
        const fragment = document.createDocumentFragment();
        visible.forEach((exercise) => fragment.append(createCard(exercise)));
        results.replaceChildren(fragment);

        const hasMore = Boolean(entry.next) || entry.exercises.length > entry.shown;
        empty.hidden = visible.length > 0;
        more.hidden = Boolean(query) || !hasMore;
        const name = categoryName();
        if (query) {
            status.textContent = `${visible.length} ${visible.length === 1 ? "match" : "matches"} for "${search.value.trim()}" among ${entry.exercises.length} loaded ${name} exercises.`;
        } else if (hasMore) {
            status.textContent = `${entry.shown} ${name} exercises with photos shown. Load more to see others.`;
        } else {
            status.textContent = `All ${entry.shown} ${name} exercises with photos are shown.`;
        }
    }

    function selectCategory(id) {
        category = id;
        categoryButtons.forEach((button) => {
            button.setAttribute("aria-pressed", String(button.dataset.category === id));
        });
        saveState();
        if (cache.has(id)) {
            errorBox.hidden = true;
            render();
        } else {
            results.replaceChildren();
            more.hidden = true;
            empty.hidden = true;
            load();
        }
    }

    categoryButtons.forEach((button) => {
        button.addEventListener("click", () => selectCategory(button.dataset.category));
    });
    search.addEventListener("input", () => {
        saveState();
        render();
    });
    more.addEventListener("click", () => load(true));
    retry.addEventListener("click", () => lastRequest?.());

    // Another tab logged in, out or changed saved exercises: redraw the Save buttons for the
    // account that is logged in now.
    function followSession() {
        viewerEmail = authStore.currentUser()?.email ?? null;
        render();
    }
    window.addEventListener("storage", (event) => {
        if (event.key === null || event.key === SESSION_STORAGE_KEY || event.key === USERS_KEY) {
            followSession();
        }
    });

    search.value = typeof saved.query === "string" ? saved.query : "";
    selectCategory(category);
}

initializeLibrary();
