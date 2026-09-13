/* The landing-page selection and permanent QR menu share the owner's content. */
(() => {
  "use strict";
  const fullPage = document.body.hasAttribute("data-full-menu-page");
  const params = new URLSearchParams(window.location.search);
  const state = { preview: "coffee", main: fullPage ? params.get("section") || "All" : "coffee", category: "All", currency: params.get("currency") === "lbp" ? "lbp" : "usd", query: fullPage ? params.get("q") || "" : "" };
  const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
  const lbp = new Intl.NumberFormat("en-US");
  const escape = value => String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
  const normalize = value => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const price = value => !Number.isFinite(value) || value < 0 ? "Ask in store" : state.currency === "usd" ? usd.format(value) : `${lbp.format(value)} LBP`;
  const arrow = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const closeIcon = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
  const searchIcon = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" stroke-width="1.5"/><path d="m16 16 4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
  const currencyControls = () => `<div class="menu-currency" role="group" aria-label="Menu currency"><button type="button" data-menu-currency="usd" aria-pressed="${state.currency === "usd"}">USD</button><button type="button" data-menu-currency="lbp" aria-pressed="${state.currency === "lbp"}">LBP</button></div>`;
  let mount, source;
  let categories = [], items = [], groups = [];
  let booted = false;

  function adaptContent(content) {
    const menu = content?.menu;
    if (!menu || !Array.isArray(menu.items) || !Array.isArray(menu.categories) || !Array.isArray(menu.groups)) return false;
    source = menu;
    groups = menu.groups;
    const groupById = new Map(groups.map(group => [group.id, group]));
    categories = menu.categories.filter(category => groupById.has(category.groupId)).map((category, index) => ({ ...category, order: Number.isFinite(category.order) ? category.order : index })).sort((a, b) => a.order - b.order);
    const byId = new Map(categories.map(category => [category.id, category]));
    items = menu.items.filter(item => item.available !== false && byId.has(item.categoryId)).map((item, index) => {
      const category = byId.get(item.categoryId);
      return { ...item, category: category.label, groupId: category.groupId, groupLabel: groupById.get(category.groupId).label, options: Array.isArray(item.options) ? item.options : [], order: Number.isFinite(item.order) ? item.order : index };
    }).sort((a, b) => a.order - b.order);
    if (!groupById.has(state.preview)) state.preview = groups[0]?.id || "All";
    if (state.main !== "All" && !groupById.has(state.main)) state.main = groups.find(group => normalize(group.label) === normalize(state.main))?.id || "All";
    if (state.category !== "All" && !byId.has(state.category)) state.category = "All";
    return true;
  }

  function categoryButtons(values, type) {
    return values.map(value => `<button class="menu-filter" type="button" data-menu-${type}="${escape(value.id)}" aria-pressed="${value.id === state[type]}">${escape(value.label)}</button>`).join("");
  }

  function renderItem(item, preview = false) {
    const prices = Array.isArray(item.prices) ? item.prices : [];
    const hasVariants = prices.length > 1;
    const rows = prices.length ? prices.map(variant => `<span class="menu-item-price">${hasVariants || variant.label && !["Price", "Regular"].includes(variant.label) ? `<span class="menu-price-size">${escape(variant.label || "Price")}</span>` : ""}<strong>${escape(price(variant[state.currency]))}</strong></span>`).join("") : '<span class="menu-item-price">Ask in store</span>';
    return `<article class="menu-item${hasVariants ? " menu-item-with-variants" : ""}" data-menu-item="${escape(item.id)}"><div class="menu-item-heading"><h3>${escape(item.name)}</h3>${!hasVariants ? `<div class="menu-item-prices">${rows}</div>` : ""}</div>${preview ? `<p class="menu-item-category">${escape(item.category)}</p>` : ""}${item.details ? `<p class="menu-item-details">${escape(item.details)}</p>` : ""}${item.options.length ? `<p class="menu-item-options"><span>Options:</span> ${item.options.map(escape).join(" · ")}</p>` : ""}${hasVariants ? `<div class="menu-item-prices menu-item-variants">${rows}</div>` : ""}</article>`;
  }

  function renderPreview(announce = false) {
    const available = items.filter(item => state.preview === "All" || item.groupId === state.preview);
    const featured = available.filter(item => item.featured);
    const selection = (featured.length ? featured : available).slice(0, 6);
    mount.querySelector(".menu-preview-list").innerHTML = selection.length ? selection.map(item => renderItem(item, true)).join("") : '<p class="menu-unavailable">There are no items in this section today. Take a look at the full menu.</p>';
    mount.querySelectorAll("[data-menu-preview]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.menuPreview === state.preview)));
    mount.querySelector(".menu-explore").href = menuURL();
    if (announce) mount.querySelector(".menu-preview-status").textContent = `Showing ${selection.length} ${(groups.find(group => group.id === state.preview)?.label || "menu").toLowerCase()} favorites. Prices in ${state.currency.toUpperCase()}.`;
  }

  function renderSubcategories() {
    const container = mount.querySelector(".menu-subcategories");
    const subs = categories.filter(category => category.groupId === state.main);
    const label = groups.find(group => group.id === state.main)?.label || "menu";
    container.hidden = state.main === "All" || Boolean(state.query.trim());
    container.innerHTML = `<button type="button" class="menu-subcategory" data-menu-category="All" aria-pressed="${state.category === "All"}">All ${escape(label.toLowerCase())}</button>${subs.map(category => `<button type="button" class="menu-subcategory" data-menu-category="${escape(category.id)}" aria-pressed="${state.category === category.id}">${escape(category.label)}</button>`).join("")}`;
  }

  function renderExtras(extra, query) {
    const options = (Array.isArray(extra.items) ? extra.items : []).filter(option => option.available !== false && (!query || normalize(`${extra.label} ${option.name}`).includes(query)));
    if (!options.length) return "";
    return `<details class="menu-extras" data-menu-extras="${escape(extra.id)}"${query ? " open" : ""}><summary>${escape(extra.label)}<span class="menu-extras-marker" aria-hidden="true">+</span></summary><div class="menu-extras-content"><dl class="menu-extras-list">${options.map(option => `<div><dt>${escape(option.name)}</dt><dd>${option[state.currency] === 0 ? "Included" : Number.isFinite(option[state.currency]) ? `+${escape(price(option[state.currency]))}` : "Ask in store"}</dd></div>`).join("")}</dl></div></details>`;
  }

  function renderResults() {
    const results = mount.querySelector(".menu-results");
    const query = normalize(state.query.trim());
    const filtered = items.filter(item => query ? normalize([item.name, item.category, item.groupLabel, item.details || "", ...item.options, ...(item.prices || []).map(variant => variant.label || "")].join(" ")).includes(query) : (state.main === "All" || item.groupId === state.main) && (state.category === "All" || item.categoryId === state.category));
    const extras = (Array.isArray(source.extras) ? source.extras : []).filter(extra => query || state.main === "All" || extra.groupId === state.main);
    const extraResults = query ? extras.reduce((count, extra) => count + (extra.items || []).filter(option => normalize(`${extra.label} ${option.name}`).includes(query)).length, 0) : 0;
    const openExtras = [...results.querySelectorAll("details[open]")].map(detail => detail.dataset.menuExtras);
    mount.querySelector(".menu-results-count").textContent = query ? `${filtered.length} ${filtered.length === 1 ? "item" : "items"}${extraResults ? ` and ${extraResults} ${extraResults === 1 ? "extra" : "extras"}` : ""} across the full menu` : `${filtered.length} ${filtered.length === 1 ? "item" : "items"} · ${state.currency.toUpperCase()} prices`;
    if (!filtered.length && !extraResults) {
      results.innerHTML = items.length ? '<div class="menu-empty"><h2>No matches this time.</h2><p>Try “latte”, “croissant”, or browse the full menu.</p><button class="menu-reset" type="button" data-menu-reset>Show the full menu</button></div>' : '<div class="menu-empty"><h2>A fresh menu is on the way.</h2><p>Please ask the team for today’s selection.</p><a class="menu-reset" href="tel:+96124980899">Call La Stazione</a></div>';
    } else {
      results.innerHTML = groups.map(group => {
        const sections = categories.filter(category => category.groupId === group.id).map(category => {
          const matches = filtered.filter(item => item.categoryId === category.id);
          return matches.length ? `<section class="menu-result-group" aria-labelledby="menu-group-${escape(category.id)}"><div class="menu-group-heading"><h2 id="menu-group-${escape(category.id)}">${escape(category.label)}</h2></div><div class="menu-result-list">${matches.map(item => renderItem(item)).join("")}</div></section>` : "";
        }).join("");
        return sections + extras.filter(extra => extra.groupId === group.id).map(extra => renderExtras(extra, query)).join("");
      }).join("");
      results.querySelectorAll("details").forEach(detail => { detail.open = Boolean(query) || openExtras.includes(detail.dataset.menuExtras); });
    }
    mount.querySelectorAll("[data-menu-main]").forEach(button => button.setAttribute("aria-pressed", String(!query && button.dataset.menuMain === state.main)));
    mount.querySelectorAll("[data-menu-category]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.menuCategory === state.category)));
    mount.querySelector(".menu-subcategories").hidden = state.main === "All" || Boolean(query);
    mount.querySelector(".menu-search-clear").hidden = !state.query;
    updateURL();
  }

  function menuURL(category = "All") {
    const url = new URL("/menu/", window.location.origin);
    if (category && category !== "All") url.searchParams.set("section", category);
    if (state.currency === "lbp") url.searchParams.set("currency", "lbp");
    return `${url.pathname}${url.search}`;
  }

  function updateURL() {
    if (!fullPage) return;
    const url = new URL(window.location.href);
    state.main !== "All" ? url.searchParams.set("section", state.main) : url.searchParams.delete("section");
    state.currency === "lbp" ? url.searchParams.set("currency", "lbp") : url.searchParams.delete("currency");
    state.query ? url.searchParams.set("q", state.query) : url.searchParams.delete("q");
    try { history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`); } catch (_) { /* Menu remains usable when history is restricted. */ }
  }

  function setCurrency(value) {
    if (!["usd", "lbp"].includes(value)) return;
    state.currency = value;
    mount.querySelectorAll("[data-menu-currency]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.menuCurrency === value)));
    fullPage ? renderResults() : renderPreview(true);
  }

  function renderAll() {
    const connectionNote = mount.querySelector(".menu-connection-note");
    if (connectionNote) connectionNote.hidden = window.LaStazioneContent?.connected !== false;
    if (fullPage) {
      document.querySelector(".menu-page-intro h1").textContent = source.title || "The menu.";
      document.querySelector(".menu-page-intro > p").textContent = source.intro || "Your usual, or something new.";
      mount.querySelector(".menu-dialog-main").innerHTML = categoryButtons([{ id: "All", label: "All" }, ...groups], "main");
      renderSubcategories();
      renderResults();
    } else {
      mount.querySelector(".menu-main-filters").innerHTML = categoryButtons(groups, "preview");
      renderPreview();
    }
    mount.dataset.mounted = "true";
    document.dispatchEvent(new CustomEvent("lastazione:menu-rendered", { detail: { count: items.length, fullPage } }));
  }

  function buildShell() {
    if (fullPage) {
      mount.innerHTML = `<div class="menu-page-controls"><div class="menu-search-row"><div class="menu-search-wrap">${searchIcon}<label class="menu-sr-only" for="full-menu-search">Search the entire menu</label><input id="full-menu-search" class="menu-search" type="search" placeholder="Find your next favorite…" autocomplete="off" spellcheck="false" value="${escape(state.query)}"><button class="menu-search-clear" type="button" aria-label="Clear search" hidden>${closeIcon}</button></div>${currencyControls()}</div><div class="menu-main-filters menu-dialog-main" role="group" aria-label="Full menu categories"></div><div class="menu-subcategories" role="group" aria-label="Menu subcategories"></div></div><div class="menu-page-results"><p class="menu-results-count" role="status" aria-atomic="true"></p><div class="menu-results"></div><p class="menu-dialog-footnote">Take your time. We’ll take care of the coffee.</p></div>`;
      mount.querySelector(".menu-search").addEventListener("input", event => { state.query = event.target.value; renderResults(); });
    } else {
      mount.innerHTML = `<div class="menu-preview-toolbar"><div class="menu-main-filters" role="group" aria-label="Featured menu categories"></div>${currencyControls()}</div><div class="menu-preview-list"></div><div class="menu-preview-footer"><p class="menu-preview-note">A few favorites. There’s more on the menu.</p><a class="menu-explore" href="/menu/">Explore the full menu ${arrow}</a></div><span class="menu-sr-only menu-preview-status" role="status"></span>`;
    }
    mount.insertAdjacentHTML("afterbegin", '<p class="menu-connection-note" role="status" hidden>Recent menu updates are temporarily unavailable. Please confirm prices with our team.</p>');
    mount.addEventListener("click", event => {
      const button = event.target.closest("button");
      if (!button) return;
      if (button.dataset.menuCurrency) setCurrency(button.dataset.menuCurrency);
      if (button.dataset.menuPreview) { state.preview = button.dataset.menuPreview; renderPreview(true); }
      if (!fullPage) return;
      const search = mount.querySelector(".menu-search");
      if (button.dataset.menuMain) {
        state.main = button.dataset.menuMain; state.category = "All"; state.query = ""; search.value = "";
        renderSubcategories(); renderResults();
      }
      if (button.dataset.menuCategory) { state.category = button.dataset.menuCategory; renderResults(); }
      if (button.hasAttribute("data-menu-reset")) {
        state.main = "All"; state.category = "All"; state.query = ""; search.value = "";
        renderSubcategories(); renderResults(); search.focus({ preventScroll: true });
      }
      if (button.classList.contains("menu-search-clear")) {
        state.query = ""; search.value = ""; renderResults(); search.focus({ preventScroll: true });
      }
    });
    window.LaStazioneRedesignMenu = Object.freeze({ open: category => window.location.assign(menuURL(category)), refresh: content => { if (adaptContent(content)) renderAll(); } });
    renderAll();
  }

  async function boot() {
    if (booted) return;
    mount = document.querySelector("#menu-app");
    if (!mount) return;
    booted = true;
    try {
      const content = await window.LaStazioneContent.ready;
      if (!adaptContent(content)) throw new Error("The menu content is unavailable.");
      buildShell();
    } catch (_) {
      mount.innerHTML = '<p class="menu-unavailable">The menu couldn’t load. <button type="button" class="menu-retry">Try again</button>, or <a href="tel:+96124980899">call La Stazione</a>.</p>';
      mount.querySelector(".menu-retry").addEventListener("click", () => window.location.reload());
    }
  }
  document.addEventListener("lastazione:content", event => {
    if (!mount?.dataset.mounted || !adaptContent(event.detail?.content || event.detail)) return;
    renderAll();
  });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
