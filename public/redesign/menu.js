/* The redesign reads the same menu and prices as the original website. */
(() => {
  "use strict";

  function mountMenu() {
    const mount = document.querySelector("#menu-app");
    if (!mount || mount.dataset.mounted) return;
    const source = window.laStazioneMenu;
    if (!source || !Array.isArray(source.items) || !source.items.length) {
      mount.innerHTML = '<p class="menu-unavailable">Our menu is a click away. <a href="../#menu">View the menu</a>.</p>';
      return;
    }
    mount.dataset.mounted = "true";

    const items = source.items;
    const categories = source.categories;
    const mainCategories = ["Coffee", "Tea", "Food", "Beverages"];
    const state = { preview: "Coffee", main: "Coffee", category: "All", currency: "usd", query: "" };
    const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
    const lbp = new Intl.NumberFormat("en-US");
    const coffeeOptions = [
      { name: "Lactose-free milk", lbp: 50000, usd: 0.55 },
      { name: "Half-skimmed milk", lbp: 50000, usd: 0.55 },
      { name: "Skimmed milk", lbp: 0, usd: 0 },
      { name: "Almond milk", lbp: 100000, usd: 1.1 },
      { name: "Oat milk", lbp: 200000, usd: 2.2 },
      { name: "Flavor", lbp: 100000, usd: 1.1 },
      { name: "Extra shot", lbp: 50000, usd: 0.55 },
      { name: "Decaf shot", lbp: 100000, usd: 1.1 },
      { name: "Whipped cream", lbp: 50000, usd: 0.55 },
    ];
    const breadOptions = [
      { name: "Baguette white", lbp: 0, usd: 0 },
      { name: "Baguette cereal", lbp: 100000, usd: 1.1 },
      { name: "Ciabatta", lbp: 200000, usd: 2.2 },
      { name: "Pain demi", lbp: 0, usd: 0 },
    ];
    const picks = {
      Coffee: [
        ["drink-hot-coffee", "Espresso"], ["drink-hot-coffee", "Cappuccino"],
        ["drink-hot-coffee", "Latte"], ["drink-hot-coffee", "Flat white"],
        ["drink-hot-coffee", "Lebanese coffee  (Served in a coffee pot)"], ["drink-hot-coffee", "Americano"],
      ],
      Tea: [
        ["drink-tea-served-in-a-teapot", "Lemongrass & Ginger Twist"], ["drink-tea-served-in-a-teapot", "Earl Grey"],
        ["drink-matcha", "Matcha latte"], ["drink-iced-matcha", "Strawberry matcha Latte"],
        ["drink-iced-tea", "Peach"], ["drink-tea-served-in-a-teapot", "Café Blanc"],
      ],
      Food: [
        ["food-croissant-regular", "plain"], ["food-croissant-regular", "Halloumi zaatar olive"],
        ["food-sandwiches", "Labneh"], ["food-sandwiches", "Chicken Avocado"],
        ["food-salads", "Quinoa Kale"], ["food-dessert", "Chocolate Fondant"],
      ],
      Beverages: [
        ["drink-fresh-smoothies", "Berries"], ["drink-fresh-smoothies", "Strawberry & Avocado"],
        ["drink-fresh-smoothies", "Tropical"], ["drink-beverages", "Fresh Orange juice"],
        ["drink-beverages", "Fresh Pomegranate juice"], ["drink-beverages", "Perrier Sparkling water"],
      ],
    };
    const arrow = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    const closeIcon = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
    const searchIcon = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" stroke-width="1.5"/><path d="m16 16 4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
    const escape = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
    const normalize = (value) => String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const capitalized = (value) => value.charAt(0).toUpperCase() + value.slice(1);
    const price = (value) => typeof value !== "number" || value < 0 ? "Ask in store" : state.currency === "usd" ? usd.format(value) : `${lbp.format(value)} LBP`;
    const categoryName = (value) => ({ "croissant small": "Small croissants", "croissant regular": "Regular croissants", "Tea (Served in a teapot)": "Tea, served in a teapot" }[value] || value);
    const currencyControls = () => '<div class="menu-currency" role="group" aria-label="Menu currency"><button type="button" data-menu-currency="usd" aria-pressed="true">USD</button><button type="button" data-menu-currency="lbp" aria-pressed="false">LBP</button></div>';
    const categoryButtons = (values, type) => values.map((value) => `<button class="menu-filter" type="button" data-menu-${type}="${escape(value)}" aria-pressed="${value === "Coffee"}">${escape(value)}</button>`).join("");

    mount.innerHTML = `
      <div class="menu-preview-toolbar">
        <div class="menu-main-filters" role="group" aria-label="Featured menu categories">${categoryButtons(mainCategories, "preview")}</div>
        ${currencyControls()}
      </div>
      <div class="menu-preview-list"></div>
      <div class="menu-preview-footer">
        <p class="menu-preview-note">A few favorites. There's more on the menu.</p>
        <button class="menu-explore" type="button" aria-haspopup="dialog" aria-controls="full-menu" data-menu-open>Explore the full menu ${arrow}</button>
      </div>
      <span class="menu-sr-only menu-preview-status" role="status"></span>`;

    const dialog = document.createElement("dialog");
    dialog.id = "full-menu";
    dialog.className = "menu-dialog";
    dialog.setAttribute("aria-labelledby", "full-menu-title");
    dialog.innerHTML = `
      <div class="menu-dialog-header">
        <div class="menu-dialog-title-row">
          <div><h2 id="full-menu-title">The menu.</h2></div>
          <button class="menu-close" type="button" aria-label="Close menu" data-menu-close autofocus>${closeIcon}</button>
        </div>
        <div class="menu-search-row">
          <div class="menu-search-wrap">${searchIcon}<label class="menu-sr-only" for="full-menu-search">Search the entire menu</label><input id="full-menu-search" class="menu-search" type="search" placeholder="Find your next favorite…" autocomplete="off" spellcheck="false"><button class="menu-search-clear" type="button" aria-label="Clear search" hidden>${closeIcon}</button></div>
          ${currencyControls()}
        </div>
        <div class="menu-main-filters menu-dialog-main" role="group" aria-label="Full menu categories">${categoryButtons(["All", ...mainCategories], "main")}</div>
        <div class="menu-subcategories" role="group" aria-label="Menu subcategories"></div>
      </div>
      <div class="menu-dialog-scroll" tabindex="0" aria-label="Menu items">
        <p class="menu-results-count" role="status" aria-atomic="true"></p>
        <div class="menu-results"></div>
        <p class="menu-dialog-footnote">Take your time. We'll take care of the coffee.</p>
      </div>`;
    document.body.append(dialog);
    const previewList = mount.querySelector(".menu-preview-list");
    const results = dialog.querySelector(".menu-results");
    const search = dialog.querySelector(".menu-search");
    const scroller = dialog.querySelector(".menu-dialog-scroll");
    let opener = null;
    let scrollSnapshot = null;
    let openedWithPointer = false;

    function renderItem(item, preview = false) {
      const title = item.name.replace(/\s*\(([^)]+)\)/g, "").trim();
      const parenthesis = item.name.match(/\(([^)]+)\)/)?.[1];
      const details = [parenthesis, item.details].filter(Boolean).join(". ");
      const prices = Array.isArray(item.prices) ? item.prices : [];
      const hasVariants = prices.length > 1;
      const priceRows = prices.length ? prices.map((variant) => `<span class="menu-item-price">${hasVariants || variant.label && !["Price", "Regular"].includes(variant.label) ? `<span class="menu-price-size">${escape(variant.label || "Price")}</span>` : ""}<strong>${escape(price(variant[state.currency]))}</strong></span>`).join("") : '<span class="menu-item-price">Ask in store</span>';
      return `<article class="menu-item${hasVariants ? " menu-item-with-variants" : ""}" data-menu-item="${escape(item.categoryId)}:${escape(item.name)}">
        <div class="menu-item-heading"><h${preview ? "3" : "4"}>${escape(capitalized(title))}</h${preview ? "3" : "4"}>${!hasVariants ? `<div class="menu-item-prices">${priceRows}</div>` : ""}</div>
        ${preview ? `<p class="menu-item-category">${escape(categoryName(item.category))}</p>` : ""}
        ${details ? `<p class="menu-item-details">${escape(capitalized(details))}</p>` : ""}
        ${item.options?.length ? `<p class="menu-item-options"><span>Options:</span> ${item.options.map(escape).join(" · ")}</p>` : ""}
        ${hasVariants ? `<div class="menu-item-prices menu-item-variants">${priceRows}</div>` : ""}
      </article>`;
    }

    function renderPreview(announce = false) {
      const featured = picks[state.preview].map(([category, name]) => items.find((item) => item.categoryId === category && item.name === name)).filter(Boolean);
      previewList.innerHTML = featured.map((item) => renderItem(item, true)).join("");
      mount.querySelectorAll("[data-menu-preview]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.menuPreview === state.preview)));
      if (announce) mount.querySelector(".menu-preview-status").textContent = `Showing ${featured.length} ${state.preview.toLowerCase()} favorites. Prices in ${state.currency.toUpperCase()}.`;
    }

    function renderSubcategories() {
      const container = dialog.querySelector(".menu-subcategories");
      const subs = categories.filter((category) => category.mainCategory === state.main);
      container.hidden = state.main === "All" || Boolean(state.query.trim());
      container.innerHTML = `<button type="button" class="menu-subcategory" data-menu-category="All" aria-pressed="${state.category === "All"}">All ${escape(state.main.toLowerCase())}</button>${subs.map((category) => `<button type="button" class="menu-subcategory" data-menu-category="${escape(category.id)}" aria-pressed="${state.category === category.id}">${escape(categoryName(category.name))}</button>`).join("")}`;
    }

    function renderOptions(kind) {
      const coffee = kind === "coffee";
      const options = coffee ? coffeeOptions : breadOptions;
      return `<details class="menu-extras" data-menu-extras="${kind}"><summary>${coffee ? "Make your coffee yours" : "Choose your sandwich bread"}<span class="menu-extras-marker" aria-hidden="true">+</span></summary><div class="menu-extras-content"><p>${coffee ? "Milk, flavors, and a little something extra for your hot or cold coffee." : "Every sandwich is available with one of these four bread options."}</p><dl class="menu-extras-list">${options.map((option) => `<div><dt>${escape(option.name)}</dt><dd>${option[state.currency] === 0 ? "Included" : `+${escape(price(option[state.currency]))}`}</dd></div>`).join("")}</dl></div></details>`;
    }

    function renderResults() {
      const query = normalize(state.query.trim());
      const filtered = items.filter((item) => query
        ? normalize([item.name, item.category, item.mainCategory, item.details || "", ...(item.options || [])].join(" ")).includes(query)
        : (state.main === "All" || item.mainCategory === state.main) && (state.category === "All" || item.categoryId === state.category));
      const openExtras = [...results.querySelectorAll("details[open]")].map((detail) => detail.dataset.menuExtras);
      dialog.querySelector(".menu-results-count").textContent = query
        ? `${filtered.length} ${filtered.length === 1 ? "result" : "results"} across the full menu`
        : `${filtered.length} ${filtered.length === 1 ? "item" : "items"} · ${state.currency.toUpperCase()} prices`;
      if (!filtered.length) {
        results.innerHTML = '<div class="menu-empty"><h3>No matches this time.</h3><p>Try “latte”, “croissant”, or browse the full menu.</p><button class="menu-reset" type="button" data-menu-reset>Show the full menu</button></div>';
      } else {
        const orderedCategories = mainCategories.flatMap((main) => categories.filter((category) => category.mainCategory === main));
        results.innerHTML = orderedCategories.map((category) => {
          const matches = filtered.filter((item) => item.categoryId === category.id);
          if (!matches.length) return "";
          return `<section class="menu-result-group" aria-labelledby="menu-group-${escape(category.id)}"><div class="menu-group-heading"><h3 id="menu-group-${escape(category.id)}">${escape(categoryName(category.name))}</h3></div><div class="menu-result-list">${matches.map((item) => renderItem(item)).join("")}</div>${category.id === "food-sandwiches" ? renderOptions("bread") : ""}</section>`;
        }).join("");
        if (filtered.some((item) => item.mainCategory === "Coffee")) results.insertAdjacentHTML("beforeend", renderOptions("coffee"));
        results.querySelectorAll("details").forEach((detail) => { detail.open = openExtras.includes(detail.dataset.menuExtras); });
      }
      dialog.querySelectorAll("[data-menu-main]").forEach((button) => button.setAttribute("aria-pressed", String(!query && button.dataset.menuMain === state.main)));
      dialog.querySelectorAll("[data-menu-category]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.menuCategory === state.category)));
      dialog.querySelector(".menu-subcategories").hidden = state.main === "All" || Boolean(query);
      dialog.querySelector(".menu-search-clear").hidden = !state.query;
    }

    function setCurrency(value) {
      if (!["usd", "lbp"].includes(value)) return;
      state.currency = value;
      [mount, dialog].forEach((container) => container.querySelectorAll("[data-menu-currency]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.menuCurrency === value))));
      renderPreview(true);
      renderResults();
    }

    function openMenu(category, trigger) {
      if (dialog.open) return;
      state.main = mainCategories.includes(category) || category === "All" ? category : state.preview;
      state.category = "All";
      state.query = "";
      search.value = "";
      opener = trigger instanceof HTMLElement ? trigger : document.activeElement;
      renderSubcategories();
      renderResults();
      const properties = ["position", "top", "left", "right", "width", "overflow"];
      scrollSnapshot = { x: window.scrollX, y: window.scrollY, styles: properties.map((name) => [name, document.body.style.getPropertyValue(name), document.body.style.getPropertyPriority(name)]) };
      document.body.style.position = "fixed";
      document.body.style.top = `-${scrollSnapshot.y}px`;
      document.body.style.left = "0";
      document.body.style.right = "0";
      document.body.style.width = "100%";
      document.body.style.overflow = "hidden";
      dialog.showModal();
      scroller.scrollTop = 0;
      dialog.querySelector("[data-menu-close]").focus({ preventScroll: true });
      if (openedWithPointer && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        dialog.animate([{ opacity: 0, transform: "translateY(12px) scale(.985)" }, { opacity: 1, transform: "translateY(0) scale(1)" }], { duration: 240, easing: "cubic-bezier(0.23, 1, 0.32, 1)" });
      }
      openedWithPointer = false;
    }

    dialog.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        dialog.close();
      }
    });

    dialog.addEventListener("close", () => {
      if (scrollSnapshot) {
        scrollSnapshot.styles.forEach(([name, value, priority]) => value ? document.body.style.setProperty(name, value, priority) : document.body.style.removeProperty(name));
        const oldBehavior = document.documentElement.style.scrollBehavior;
        document.documentElement.style.scrollBehavior = "auto";
        window.scrollTo(scrollSnapshot.x, scrollSnapshot.y);
        document.documentElement.style.scrollBehavior = oldBehavior;
        scrollSnapshot = null;
      }
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    });

    mount.addEventListener("click", (event) => {
      const button = event.target.closest("button");
      if (!button) return;
      if (button.dataset.menuPreview) { state.preview = button.dataset.menuPreview; renderPreview(true); }
      if (button.dataset.menuCurrency) setCurrency(button.dataset.menuCurrency);
      if (button.hasAttribute("data-menu-open")) { openedWithPointer = event.detail > 0; openMenu(state.preview, button); }
    });
    dialog.addEventListener("click", (event) => {
      const button = event.target.closest("button");
      if (!button) return;
      if (button.hasAttribute("data-menu-close")) { dialog.close(); return; }
      if (button.dataset.menuCurrency) setCurrency(button.dataset.menuCurrency);
      if (button.dataset.menuMain) {
        state.main = button.dataset.menuMain;
        state.category = "All";
        state.query = "";
        search.value = "";
        renderSubcategories();
        renderResults();
        scroller.scrollTop = 0;
      }
      if (button.dataset.menuCategory) {
        state.category = button.dataset.menuCategory;
        renderResults();
        scroller.scrollTop = 0;
      }
      if (button.hasAttribute("data-menu-reset")) {
        state.main = "All";
        state.category = "All";
        state.query = "";
        search.value = "";
        renderSubcategories();
        renderResults();
        search.focus();
      }
      if (button.classList.contains("menu-search-clear")) {
        state.query = "";
        search.value = "";
        renderResults();
        scroller.scrollTop = 0;
        search.focus();
      }
    });
    let backdropPointerDown = false;
    const outsideDialog = (event) => {
      const rect = dialog.getBoundingClientRect();
      return event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom);
    };
    dialog.addEventListener("pointerdown", (event) => { backdropPointerDown = outsideDialog(event); });
    dialog.addEventListener("pointerup", (event) => { if (backdropPointerDown && outsideDialog(event)) dialog.close(); backdropPointerDown = false; });
    search.addEventListener("input", () => { state.query = search.value; renderResults(); scroller.scrollTop = 0; });

    window.LaStazioneRedesignMenu = Object.freeze({ open: openMenu, close: () => dialog.close() });
    renderPreview();
    renderSubcategories();
    renderResults();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mountMenu, { once: true });
  else mountMenu();
})();
