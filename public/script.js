const siteHeader = document.querySelector(".site-header");

function updateHeaderState() {
  siteHeader?.classList.toggle("is-scrolled", window.scrollY > 32);
}

updateHeaderState();
window.addEventListener("scroll", updateHeaderState, { passive: true });

const menuSource = window.laStazioneMenu || { mainCategories: [], categories: [], items: [] };
const menuItems = Array.isArray(menuSource.items) ? menuSource.items : [];
const menuCategories = Array.isArray(menuSource.categories)
  ? menuSource.categories
  : [...new Set(menuItems.map((item) => item.category))].map((name) => ({
      name,
      mainCategory: inferMainCategory(name, "drink"),
    }));
const mainCategories = Array.isArray(menuSource.mainCategories) && menuSource.mainCategories.length
  ? menuSource.mainCategories
  : ["Food", "Coffee", "Tea", "Beverages"];

const grid = document.querySelector("#menu-grid");
const mainTabs = document.querySelector("#main-category-tabs");
const tabs = document.querySelector("#category-tabs");
const search = document.querySelector("#menu-search");
const priceOptions = document.querySelector("#price-options");
const menuNotice = document.querySelector("#menu-notice");
const lbpFormatter = new Intl.NumberFormat("en-US");
const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

let activeMainCategory = mainCategories[0] || "Food";
let activeCategory = "All";
let selectedCurrency = "lbp";

const sandwichBreadOptions = [
  { name: "Baguette white", lbp: 0, usd: 0 },
  { name: "Baguette cereal", lbp: 100000, usd: 1.1 },
  { name: "Ciabatta", lbp: 200000, usd: 2.2 },
  { name: "Pain demi", lbp: 0, usd: 0 },
];

const coffeeAddOns = [
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

function inferMainCategory(category, type) {
  if (type === "food") return "Food";

  const normalized = String(category || "").trim().toLowerCase();
  if (normalized.startsWith("tea") || ["iced tea", "matcha", "iced matcha"].includes(normalized)) return "Tea";
  if (["hot coffee", "cold coffee", "specialty drinks"].includes(normalized)) return "Coffee";
  return "Beverages";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function hasPrice(value) {
  return typeof value === "number" && value > 0;
}

function formatPrice(value) {
  if (!hasPrice(value)) return "Ask";
  if (selectedCurrency === "usd") return usdFormatter.format(value);
  return `LBP ${lbpFormatter.format(value)}`;
}

function categoryMain(category) {
  return category.mainCategory || inferMainCategory(category.name, category.type);
}

function itemMain(item) {
  return item.mainCategory || inferMainCategory(item.category, item.type);
}

function getSubcategories() {
  return menuCategories
    .filter((category) => categoryMain(category) === activeMainCategory)
    .map((category) => category.name);
}

function renderMainTabs() {
  mainTabs.innerHTML = mainCategories
    .map(
      (category) => `
        <button class="${category === activeMainCategory ? "is-active" : ""}" type="button" aria-pressed="${category === activeMainCategory}" data-main-category="${escapeHtml(category)}">
          ${escapeHtml(category)}
        </button>
      `
    )
    .join("");
}

function renderTabs() {
  const subcategories = getSubcategories();
  tabs.innerHTML = [`All ${activeMainCategory}`, ...subcategories]
    .map((category, index) => {
      const value = index === 0 ? "All" : category;
      return `
        <button class="${value === activeCategory ? "is-active" : ""}" type="button" aria-pressed="${value === activeCategory}" data-category="${escapeHtml(value)}">
          ${escapeHtml(category)}
        </button>
      `;
    })
    .join("");
}

function renderPriceOptions() {
  priceOptions.querySelectorAll("button").forEach((button) => {
    const isActive = button.dataset.currency === selectedCurrency;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

function renderMenuNotice() {
  let title = "";
  let description = "";
  let options = [];

  if (activeMainCategory === "Coffee") {
    title = "Coffee add-ons";
    description = "Personalize any hot or cold coffee with these options.";
    options = coffeeAddOns;
  } else if (activeMainCategory === "Food" && activeCategory === "Sandwiches") {
    title = "Choose your bread";
    description = "Every sandwich is available with one of these four bread options.";
    options = sandwichBreadOptions;
  }

  if (!options.length) {
    menuNotice.hidden = true;
    menuNotice.innerHTML = "";
    return;
  }

  menuNotice.hidden = false;
  menuNotice.innerHTML = `
    <div class="menu-notice-heading">
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(description)}</p>
    </div>
    <div class="menu-option-grid">
      ${options
        .map((option) => {
          const price = option[selectedCurrency];
          const label = hasPrice(price) ? `+${formatPrice(price)}` : "Included";
          return `
            <span class="menu-option">
              <span>${escapeHtml(option.name)}</span>
              <strong>${escapeHtml(label)}</strong>
            </span>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderPriceRows(item) {
  const prices = Array.isArray(item.prices) ? item.prices : [];
  const rows = prices.filter((price) => hasPrice(price[selectedCurrency]));

  if (!rows.length) {
    return `
      <div class="price-row">
        <span>Price</span>
        <strong>Ask</strong>
      </div>
    `;
  }

  return rows
    .map(
      (price) => `
        <div class="price-row">
          <span>${escapeHtml(price.label || "Price")}</span>
          <strong>${formatPrice(price[selectedCurrency])}</strong>
        </div>
      `
    )
    .join("");
}

function renderMenu() {
  const query = search.value.trim().toLowerCase();
  const filtered = menuItems.filter((item) => {
    const matchesMainCategory = itemMain(item) === activeMainCategory;
    const matchesCategory = activeCategory === "All" || item.category === activeCategory;
    const searchable = [item.name, item.category, item.mainCategory, item.details, ...(item.options || [])]
      .join(" ")
      .toLowerCase();
    return matchesMainCategory && matchesCategory && searchable.includes(query);
  });

  if (!filtered.length) {
    grid.innerHTML = `<p class="empty-state">No menu items match that search.</p>`;
    return;
  }

  grid.innerHTML = filtered
    .map((item) => {
      const details = item.details ? `<p>${escapeHtml(item.details)}</p>` : "";
      const options = item.options?.length
        ? `<div class="option-list">${item.options
            .map((option) => `<span class="option-pill">${escapeHtml(option)}</span>`)
            .join("")}</div>`
        : "";

      return `
        <article class="menu-card">
          <span class="menu-category">${escapeHtml(item.category)}</span>
          <h3>${escapeHtml(item.name)}</h3>
          ${details}
          ${options}
          <div class="price-list">${renderPriceRows(item)}</div>
        </article>
      `;
    })
    .join("");
}

mainTabs.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  activeMainCategory = button.dataset.mainCategory;
  activeCategory = "All";
  renderMainTabs();
  renderTabs();
  renderMenuNotice();
  renderMenu();
});

tabs.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  activeCategory = button.dataset.category;
  renderTabs();
  renderMenuNotice();
  renderMenu();
});

priceOptions.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  selectedCurrency = button.dataset.currency;
  renderPriceOptions();
  renderMenuNotice();
  renderMenu();
});

search.addEventListener("input", renderMenu);

const photoFeed = document.querySelector(".photo-feed");

if (photoFeed) {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let galleryPaused = false;
  let galleryDirection = 1;
  let galleryLastFrame = 0;
  let galleryPosition = photoFeed.scrollLeft;
  let galleryResumeTimer;
  let dragStartX = 0;
  let dragStartScroll = 0;
  let mouseDragging = false;

  const pauseGallery = () => {
    galleryPaused = true;
    window.clearTimeout(galleryResumeTimer);
  };

  const resumeGallery = (delay = 2200) => {
    window.clearTimeout(galleryResumeTimer);
    galleryResumeTimer = window.setTimeout(() => {
      galleryPosition = photoFeed.scrollLeft;
      galleryPaused = false;
    }, delay);
  };

  const animateGallery = (time) => {
    const elapsed = Math.min(time - (galleryLastFrame || time), 40);
    galleryLastFrame = time;

    if (!galleryPaused && !document.hidden && !reducedMotion.matches) {
      const maxScroll = photoFeed.scrollWidth - photoFeed.clientWidth;

      if (maxScroll > 0) {
        if (photoFeed.scrollLeft >= maxScroll - 1) galleryDirection = -1;
        if (photoFeed.scrollLeft <= 1) galleryDirection = 1;
        galleryPosition = Math.max(
          0,
          Math.min(maxScroll, galleryPosition + galleryDirection * elapsed * 0.018)
        );
        photoFeed.scrollLeft = galleryPosition;
      }
    }

    window.requestAnimationFrame(animateGallery);
  };

  photoFeed.addEventListener("pointerdown", (event) => {
    pauseGallery();
    if (event.pointerType !== "mouse") return;

    mouseDragging = true;
    dragStartX = event.clientX;
    dragStartScroll = photoFeed.scrollLeft;
    photoFeed.classList.add("is-dragging");
    photoFeed.setPointerCapture(event.pointerId);
  });

  photoFeed.addEventListener("pointermove", (event) => {
    if (!mouseDragging) return;
    photoFeed.scrollLeft = dragStartScroll - (event.clientX - dragStartX);
    galleryPosition = photoFeed.scrollLeft;
  });

  const finishGalleryInteraction = () => {
    mouseDragging = false;
    photoFeed.classList.remove("is-dragging");
    resumeGallery();
  };

  photoFeed.addEventListener("pointerup", finishGalleryInteraction);
  photoFeed.addEventListener("pointercancel", finishGalleryInteraction);
  photoFeed.addEventListener("wheel", () => {
    pauseGallery();
    resumeGallery();
  }, { passive: true });
  photoFeed.addEventListener("mouseenter", pauseGallery);
  photoFeed.addEventListener("mouseleave", () => resumeGallery(900));
  photoFeed.addEventListener("focusin", pauseGallery);
  photoFeed.addEventListener("focusout", () => resumeGallery());

  window.requestAnimationFrame(animateGallery);
}

function loadVideo(video) {
  if (video.dataset.loaded === "true") return;

  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;
  const source = document.createElement("source");
  source.src = video.dataset.src;
  source.type = "video/mp4";
  video.appendChild(source);
  video.dataset.loaded = "true";
  video.load();
}

function playVideo(video) {
  loadVideo(video);
  video.play().catch(() => {});
}

const lazyVideos = document.querySelectorAll(".lazy-video");
const videoObserver = "IntersectionObserver" in window
  ? new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            playVideo(entry.target);
          } else {
            entry.target.pause();
          }
        });
      },
      { threshold: 0.35 }
    )
  : null;

lazyVideos.forEach((video) => {
  if (videoObserver) {
    videoObserver.observe(video);
  } else {
    playVideo(video);
  }

  video.addEventListener("mouseenter", () => {
    playVideo(video);
  });
  video.addEventListener("mouseleave", () => {
    video.pause();
  });
  video.addEventListener("click", () => {
    if (video.paused) {
      playVideo(video);
    } else {
      video.pause();
    }
  });
});

renderMainTabs();
renderTabs();
renderPriceOptions();
renderMenuNotice();
renderMenu();
