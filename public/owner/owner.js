(() => {
  'use strict';
  const $ = (selector) => document.querySelector(selector);
  const editor = $('#editor');
  const accountEmail = window.LaStazioneAuth?.user?.email?.toLowerCase();
  if (!accountEmail) return;
  const legacyStorageKey = 'la-stazione-owner-draft-v1';
  const storageKey = `la-stazione-owner-draft-v2:${accountEmail}`;
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const escape = (value = '') => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const id = (prefix) => `${prefix}-${crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2)}`;
  let content, published, base, baseEtag, selectedId, tab = 'items', gallery = 'hero', query = '', categoryFilter = '';
  let dirty = false, busy = false, activity = '', uploading = false, conflicted = false, storageFailed = false, persistTimer;
  let history = [];
  const icons = {
    up: '<path d="m6 13 6-6 6 6M12 7v12"/>',
    down: '<path d="m6 11 6 6 6-6M12 5v12"/>',
    remove: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5M14 11v5"/>'
  };
  const iconButton = (action, label, index, disabled = false, extra = '') => `<button type="button" class="icon-button ${action.includes('delete') || action.includes('remove') ? 'danger' : ''}" data-action="${action}" data-index="${index}" ${extra} aria-label="${escape(label)}" title="${escape(label)}" ${disabled ? 'disabled' : ''}><svg viewBox="0 0 24 24" aria-hidden="true">${icons[action.includes('up') ? 'up' : action.includes('down') ? 'down' : 'remove']}</svg></button>`;
  const field = (label, path, value, opts = {}) => {
    const name = `field-${path.replaceAll('.', '-')}`;
    const common = `id="${name}" data-path="${path}" ${opts.required ? 'required' : ''} ${opts.placeholder ? `placeholder="${escape(opts.placeholder)}"` : ''}`;
    let input;
    if (opts.options) input = `<select ${common}>${opts.options.map(option => `<option value="${escape(option.value)}" ${String(value ?? '') === String(option.value) ? 'selected' : ''}>${escape(option.label)}</option>`).join('')}</select>`;
    else if (opts.textarea) input = `<textarea ${common} rows="${opts.rows || 3}">${escape(value)}</textarea>`;
    else input = `<input ${common} type="${opts.type || 'text'}" value="${escape(value)}" ${opts.type === 'number' ? 'min="0" step="any" inputmode="decimal"' : ''}>`;
    return `<label class="field" for="${name}"><span>${escape(label)}</span>${input}${opts.hint ? `<small>${escape(opts.hint)}</small>` : ''}</label>`;
  };
  const check = (label, path, value) => `<label class="check-field"><input type="checkbox" data-path="${path}" ${value ? 'checked' : ''}><span>${escape(label)}</span></label>`;
  const groupOptions = () => content.menu.groups.map(group => ({ value: group.id, label: group.label }));
  const categoryOptions = () => content.menu.categories.map(category => ({ value: category.id, label: category.label }));
  const categoryName = (categoryId) => content.menu.categories.find(category => category.id === categoryId)?.label || 'No category';
  const ordered = (rows) => rows.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const currentItem = () => content.menu.items.find(item => item.id === selectedId);

  function notify(text, error = false, action) {
    const message = $('#message');
    message.className = `message${error ? ' error' : ''}`;
    message.replaceChildren(document.createTextNode(text));
    if (action) {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'text-button'; button.textContent = action.label;
      button.addEventListener('click', action.run); message.append(button);
    }
    message.hidden = !text;
  }
  function persist() {
    clearTimeout(persistTimer);
    try {
      if (dirty) localStorage.setItem(storageKey, JSON.stringify({ content, base, baseEtag, savedAt: new Date().toISOString() }));
      else localStorage.removeItem(storageKey);
      storageFailed = false;
    } catch {
      if (!storageFailed) notify('This browser could not save your draft on this device. Your edits are still open in this tab; download a backup before leaving.', true);
      storageFailed = true;
    }
    updateStatus();
  }
  function changed() {
    dirty = JSON.stringify(content) !== JSON.stringify(published);
    clearTimeout(persistTimer);
    persistTimer = setTimeout(persist, 300);
    updateStatus();
  }
  function updateStatus() {
    $('#publish').disabled = !content || !dirty || busy || uploading || conflicted || !window.LaStazioneContent?.connected;
    $('#discard').disabled = !content || (!dirty && !conflicted) || busy || uploading;
    $('#undo').disabled = !history.length || busy || uploading;
    $('#export').disabled = !content;
    $('#import').disabled = !content || busy || uploading;
    $('#import-trigger').disabled = !content || busy || uploading;
    $('#state-dot').className = `state-dot ${dirty ? 'dirty' : 'saved'}`;
    $('#publish').textContent = busy && activity === 'publish' ? 'Publishing…' : 'Publish changes';
    if (!content) return;
    $('#save-state').textContent = busy ? (activity === 'publish' ? 'Publishing your changes…' : 'Loading published content…') : uploading ? 'Uploading photos…' : !window.LaStazioneContent.connected ? 'Working offline' : conflicted ? 'Published content has changed' : dirty ? 'Unpublished draft' : 'Everything is published';
    $('#save-detail').textContent = !window.LaStazioneContent.connected ? 'Editing is available. Reconnect to load and publish shared content.' : conflicted ? 'Download your draft, then discard it to load the latest published content.' : dirty ? (storageFailed ? 'Draft held in this tab. Download a backup before leaving.' : 'Draft saved on this device. Publish when you are ready.') : 'The menu and website show this content.';
    $('#item-count').textContent = content.menu.items.length;
  }
  function checkpoint() {
    history.push({ content: clone(content), selectedId });
    if (history.length > 25) history.shift();
  }
  function mutate(callback, message = '') {
    checkpoint(); callback(); changed(); render();
    if (message) notify(message, false, { label: 'Undo', run: undo });
  }
  function undo() {
    const previous = history.pop();
    if (!previous) return;
    content = previous.content; selectedId = previous.selectedId; changed(); render(); notify('Last action undone.');
  }
  function setPath(path, value) {
    const segments = path.split('.');
    const key = segments.pop();
    let object = content;
    for (const segment of segments) object = object[segment];
    object[key] = value;
  }
  function normalize(data) {
    if (!data || data.schemaVersion !== 1 || !data.menu || !data.photos || !['groups', 'categories', 'items', 'extras'].every(key => Array.isArray(data.menu[key])) || !['hero', 'moments'].every(key => Array.isArray(data.photos[key]))) throw new Error('This file is not a La Stazione content backup.');
    data.menu.extras.forEach(section => {
      if (!Array.isArray(section.groupIds)) section.groupIds = section.groupId ? [section.groupId] : [];
      if (!Array.isArray(section.categoryIds)) section.categoryIds = [];
      delete section.groupId;
    });
    data.menu.title ??= 'Our menu'; data.menu.intro ??= '';
    data.menu.categories.forEach((category, index) => { category.order ??= index; });
    data.menu.items.forEach((item, index) => {
      item.details ??= ''; item.options ??= []; item.prices ??= []; item.available ??= true; item.featured ??= false; item.order ??= index;
    });
    data.photos.hero.forEach(photo => { photo.alt ??= ''; photo.caption ??= ''; });
    data.photos.moments.forEach(photo => { photo.alt ??= ''; photo.caption ??= ''; });
    return data;
  }
  function render() {
    if (!content) return;
    editor.setAttribute('aria-busy', 'false');
    document.querySelectorAll('[data-tab]').forEach(button => {
      if (button.dataset.tab === tab) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
    if (tab === 'items') renderItems();
    if (tab === 'structure') renderStructure();
    if (tab === 'extras') renderExtras();
    if (tab === 'photos') renderPhotos();
    updateStatus();
  }
  function itemListHTML() {
    const rows = ordered(content.menu.items).filter(item => (!categoryFilter || item.categoryId === categoryFilter) && `${item.name} ${item.details} ${categoryName(item.categoryId)}`.toLowerCase().includes(query.toLowerCase()));
    if (!rows.length) return '<li class="empty-state"><p>No matching items. Try another search or add an item.</p></li>';
    return rows.map(item => `<li><button type="button" class="item-select" data-action="select-item" data-id="${escape(item.id)}" ${item.id === selectedId ? 'aria-current="true"' : ''}><span><strong>${escape(item.name || 'Untitled item')}</strong><small>${escape(categoryName(item.categoryId))}</small>${item.available === false ? '<span class="unavailable">Unavailable</span>' : ''}</span><span class="item-price">${item.prices[0]?.usd != null ? '$' + escape(Number(item.prices[0].usd).toFixed(2)) : ''}</span></button></li>`).join('');
  }
  function renderItems() {
    if (!currentItem() && content.menu.items.length) selectedId = ordered(content.menu.items)[0].id;
    editor.innerHTML = `<div class="item-workspace"><aside class="item-sidebar" aria-label="Choose a menu item"><div class="list-toolbar"><h2>Your menu</h2><button type="button" class="button small" data-action="add-item">Add item</button></div><div class="search-fields"><label class="sr-only" for="item-search">Search menu items</label><input id="item-search" type="search" placeholder="Search your menu" value="${escape(query)}"><label class="sr-only" for="category-filter">Filter by category</label><select id="category-filter"><option value="">All categories</option>${content.menu.categories.map(category => `<option value="${escape(category.id)}" ${categoryFilter === category.id ? 'selected' : ''}>${escape(category.label)}</option>`).join('')}</select></div><ul class="item-list" id="item-list">${itemListHTML()}</ul></aside><section class="item-editor" id="item-editor" aria-label="Edit selected item">${itemEditorHTML()}</section></div>`;
  }
  function itemEditorHTML() {
    const item = currentItem();
    if (!item) return '<div class="empty-state"><h2>Start with something delicious.</h2><p>Add your first menu item, then give it a name, a category, and a price.</p><button type="button" class="button primary" data-action="add-item">Add an item</button></div>';
    const index = content.menu.items.indexOf(item), path = `menu.items.${index}`;
    const siblings = ordered(content.menu.items.filter(other => other.categoryId === item.categoryId)), position = siblings.indexOf(item);
    return `<div class="editor-heading"><div><h2 id="item-editor-title">${escape(item.name || 'New menu item')}</h2><p>Changes stay in your draft until you publish.</p></div><div class="heading-actions">${iconButton('item-up', 'Move item earlier in its category', index, position === 0)}${iconButton('item-down', 'Move item later in its category', index, position === siblings.length - 1)}</div></div>${field('Item name', `${path}.name`, item.name, { required: true, placeholder: 'For example, Iced latte' })}${field('Category', `${path}.categoryId`, item.categoryId, { options: categoryOptions() })}${field('Description', `${path}.details`, item.details, { textarea: true, hint: 'Ingredients, tasting notes, or anything a guest should know.' })}<div class="check-fields">${check('Available on the menu', `${path}.available`, item.available)}${check('Feature on the website', `${path}.featured`, item.featured)}</div><div class="subsection"><div class="subsection-heading"><h3>Prices &amp; sizes</h3><button type="button" class="button small" data-action="add-price">Add price</button></div><p>Add one price, or several sizes and variants. Leave an unused currency blank.</p>${item.prices.map((price, i) => `<div class="price-row">${field('Size or variant', `${path}.prices.${i}.label`, price.label, { placeholder: 'Regular, Large…' })}${field('USD', `${path}.prices.${i}.usd`, price.usd, { type: 'number', placeholder: '0.00' })}${field('LBP', `${path}.prices.${i}.lbp`, price.lbp, { type: 'number', placeholder: '0' })}${iconButton('remove-price', 'Remove this price', i)}</div>`).join('') || '<p class="hint">No prices yet. Add a price before publishing this item.</p>'}</div><div class="subsection"><div class="subsection-heading"><h3>Choices &amp; options</h3><button type="button" class="button small" data-action="add-option">Add option</button></div><p>For choices such as oat milk, decaf, or flavours. Priced add-ons belong in Extras.</p><div class="row-list">${item.options.map((option, i) => `<div class="option-row">${field(`Option ${i + 1}`, `${path}.options.${i}`, option, { placeholder: 'For example, Oat milk' })}${iconButton('remove-option', `Remove option ${i + 1}`, i)}</div>`).join('')}</div></div><div class="editor-footer"><button type="button" class="button" data-action="duplicate-item">Duplicate item</button><button type="button" class="text-button danger" data-action="delete-item">Remove item</button></div>`;
  }
  function renderStructure() {
    editor.innerHTML = `<div class="tab-body"><section class="content-section"><div class="section-heading"><div><h2>Words at the top</h2><p>The heading and introduction guests see on the full menu.</p></div></div><div class="compact-form">${field('Menu title', 'menu.title', content.menu.title, { required: true })}${field('Menu introduction', 'menu.intro', content.menu.intro, { textarea: true })}</div></section><section class="content-section"><div class="section-heading"><div><h2>Menu groups</h2><p>The broad parts of your menu, such as drinks and food.</p></div><button type="button" class="button" data-action="add-group">Add group</button></div>${content.menu.groups.map((group, i) => `<div class="structure-row group-row"><div>${field('Group name', `menu.groups.${i}.label`, group.label, { required: true })}<small class="hint">${content.menu.categories.filter(category => category.groupId === group.id).length} categories</small></div><div class="row-actions">${iconButton('group-up', 'Move group earlier', i, i === 0)}${iconButton('group-down', 'Move group later', i, i === content.menu.groups.length - 1)}${iconButton('delete-group', 'Remove group', i)}</div></div>`).join('') || '<p class="hint">Add a group to organize your menu.</p>'}</section><section class="content-section"><div class="section-heading"><div><h2>Categories</h2><p>Change their names, move them between groups, and set their order.</p></div><button type="button" class="button" data-action="add-category">Add category</button></div>${content.menu.categories.map((category, i) => `<div class="structure-row"><div>${field('Category name', `menu.categories.${i}.label`, category.label, { required: true })}<small class="hint">${content.menu.items.filter(item => item.categoryId === category.id).length} items</small></div>${field('Menu group', `menu.categories.${i}.groupId`, category.groupId, { options: groupOptions() })}<div class="row-actions">${iconButton('category-up', 'Move category earlier', i, i === 0)}${iconButton('category-down', 'Move category later', i, i === content.menu.categories.length - 1)}${iconButton('delete-category', 'Remove category and its items', i)}</div></div>`).join('') || '<p class="hint">Add a category before adding menu items.</p>'}</section></div>`;
  }
  function extraAssignments(section, sectionIndex) {
    const choice = (kind, value, label, checked, disabled = false) => `<label class="extra-scope-option"><input type="checkbox" data-extra-scope="${kind}" data-section="${sectionIndex}" value="${escape(value)}" ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''}><span>${escape(label)}</span></label>`;
    return `<fieldset class="extra-assignments"><legend>Applies to</legend><p class="hint">Choose one or more categories or subcategories. A whole category includes all its subcategories.</p><div class="extra-scope-groups">${content.menu.groups.map(group => {
      const whole = section.groupIds.includes(group.id);
      return `<div class="extra-scope-group">${choice('groupIds', group.id, 'All ' + group.label, whole)}<div class="extra-scope-children">${content.menu.categories.filter(category => category.groupId === group.id).map(category => choice('categoryIds', category.id, category.label, whole || section.categoryIds.includes(category.id), whole)).join('')}</div></div>`;
    }).join('')}</div></fieldset>`;
  }
  function renderExtras() {
    editor.innerHTML = `<div class="tab-body"><div class="section-heading"><div><h2>A little extra</h2><p>Manage priced additions, such as extra espresso or alternative milk.</p></div><button type="button" class="button" data-action="add-extra-group">Add section</button></div>${content.menu.extras.map((section, sectionIndex) => `<section class="extras-section"><div class="two-fields">${field('Section name', `menu.extras.${sectionIndex}.label`, section.label, { required: true })}</div>${extraAssignments(section, sectionIndex)}${section.items.map((extra, i) => `<div class="price-row extra-price-row">${field('Extra name', `menu.extras.${sectionIndex}.items.${i}.name`, extra.name, { required: true })}${field('USD', `menu.extras.${sectionIndex}.items.${i}.usd`, extra.usd, { type: 'number' })}${field('LBP', `menu.extras.${sectionIndex}.items.${i}.lbp`, extra.lbp, { type: 'number' })}<div class="row-actions">${iconButton('extra-up', 'Move extra earlier', i, i === 0, `data-section="${sectionIndex}"`)}${iconButton('extra-down', 'Move extra later', i, i === section.items.length - 1, `data-section="${sectionIndex}"`)}${iconButton('delete-extra', 'Remove extra', i, false, `data-section="${sectionIndex}"`)}</div></div>`).join('')}<div class="editor-footer"><button type="button" class="button" data-action="add-extra" data-index="${sectionIndex}">Add extra</button><div class="row-actions">${iconButton('extra-group-up', 'Move extras section earlier', sectionIndex, sectionIndex === 0)}${iconButton('extra-group-down', 'Move extras section later', sectionIndex, sectionIndex === content.menu.extras.length - 1)}<button type="button" class="text-button danger" data-action="delete-extra-group" data-index="${sectionIndex}">Remove section</button></div></div></section>`).join('') || '<div class="empty-state"><h2>Room for the finishing touches.</h2><p>Add an extras section to offer guests a little more.</p></div>'}</div>`;
  }
  function renderPhotos() {
    const photos = content.photos[gallery];
    const location = gallery === 'hero' ? 'The swipable photos below “Take a coffee break”.' : 'The “Life tastes better here” photo gallery.';
    editor.innerHTML = `<div class="tab-body"><div class="section-heading"><div><h2>Life at La Stazione</h2><p>Add as many photos as you like. Their order here is their order on the website.</p></div></div><div class="photo-toolbar"><div class="photo-switch" aria-label="Choose a photo gallery"><button type="button" data-action="gallery" data-gallery="hero" aria-pressed="${gallery === 'hero'}">Opening photos (${content.photos.hero.length})</button><button type="button" data-action="gallery" data-gallery="moments" aria-pressed="${gallery === 'moments'}">Life tastes better (${content.photos.moments.length})</button></div><label class="button primary upload-button">${uploading ? 'Uploading…' : 'Upload photos'}<input id="photo-upload" type="file" accept="image/*" multiple aria-label="Upload photos" ${uploading ? 'disabled' : ''}></label></div><p class="hint" style="margin-bottom:18px">${location} Uploads are prepared for fast loading automatically.</p><form class="add-url" id="photo-url-form"><label class="field" for="photo-url"><span>Or use an image link</span><input class="url-input" id="photo-url" type="url" placeholder="https://…" required></label><button type="submit" class="button">Add photo</button></form><div class="photo-grid">${photos.map((photo, i) => `<article class="photo-card"><div class="photo-preview"><img src="${escape(photo.url.replace(/^\/redesign(?:_v[1-6])?\/photos\//, "/assets/site/photos/"))}" alt="${escape(photo.alt)}" loading="lazy"><span class="photo-number">${i + 1} of ${photos.length}</span></div><div class="photo-card-body">${field('Caption', `photos.${gallery}.${i}.caption`, photo.caption, { placeholder: 'A little moment at the café' })}${field('Image description', `photos.${gallery}.${i}.alt`, photo.alt, { hint: 'Describe the photo for guests using a screen reader.' })}<details><summary>Image link</summary>${field('Photo URL', `photos.${gallery}.${i}.url`, photo.url, { type: 'url' })}</details><div class="photo-card-actions"><div>${iconButton('photo-up', 'Move photo earlier', i, i === 0)}${iconButton('photo-down', 'Move photo later', i, i === photos.length - 1)}</div><button type="button" class="text-button danger" data-action="delete-photo" data-index="${i}">Remove photo</button></div></div></article>`).join('')}</div>${!photos.length ? '<div class="empty-state"><h2>Make room for a new moment.</h2><p>Upload photos or add image links. This section stays hidden on the website until it has a photo.</p></div>' : ''}</div>`;
  }
  function swap(array, index, step) {
    const destination = index + step;
    if (destination < 0 || destination >= array.length) return;
    [array[index], array[destination]] = [array[destination], array[index]];
  }
  function ensureCategory() {
    if (!content.menu.groups.length) content.menu.groups.push({ id: id('group'), label: 'Our menu' });
    if (!content.menu.categories.length) content.menu.categories.push({ id: id('category'), label: 'New category', groupId: content.menu.groups[0].id, order: 0 });
    return content.menu.categories.find(category => category.id === categoryFilter)?.id || content.menu.categories[0].id;
  }
  function focusName() { requestAnimationFrame(() => $('#item-editor input')?.focus()); }
  function selectItem(itemId) {
    selectedId = itemId; renderItems();
    if (matchMedia('(max-width:760px)').matches) $('#item-editor').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion:reduce)').matches ? 'instant' : 'smooth', block: 'start' });
  }
  editor.addEventListener('click', event => {
    const button = event.target.closest('[data-action]');
    if (!button || busy || uploading) return;
    const action = button.dataset.action, index = Number(button.dataset.index), sectionIndex = Number(button.dataset.section);
    if (action === 'select-item') return selectItem(button.dataset.id);
    if (action === 'gallery') { gallery = button.dataset.gallery; renderPhotos(); return; }
    if (action === 'delete-group') {
      const group = content.menu.groups[index];
      if (content.menu.categories.some(category => category.groupId === group.id) || content.menu.extras.some(section => section.groupIds.includes(group.id))) return notify('Move or remove this group’s categories and extras first. Then you can remove the empty group.', true);
    }
    if (action === 'delete-category' && content.menu.extras.some(section => section.categoryIds.includes(content.menu.categories[index].id))) return notify('Change the extras assigned to this subcategory before removing it.', true);
    mutate(() => {
      const item = currentItem();
      if (action === 'add-item') {
        const categoryId = ensureCategory(); selectedId = id('item'); query = '';
        content.menu.items.push({ id: selectedId, categoryId, name: '', details: '', options: [], prices: [{ label: '', usd: null, lbp: null }], available: true, featured: false, order: Math.max(-1, ...content.menu.items.map(entry => entry.order || 0)) + 1 });
      }
      if (action === 'duplicate-item' && item) { const duplicate = clone(item); duplicate.id = id('item'); duplicate.name += ' (copy)'; duplicate.order = Math.max(-1, ...content.menu.items.map(entry => entry.order || 0)) + 1; content.menu.items.push(duplicate); selectedId = duplicate.id; }
      if (action === 'delete-item' && item) { content.menu.items.splice(content.menu.items.indexOf(item), 1); selectedId = null; }
      if ((action === 'item-up' || action === 'item-down') && item) { const siblings = ordered(content.menu.items.filter(entry => entry.categoryId === item.categoryId)); swap(siblings, siblings.indexOf(item), action === 'item-up' ? -1 : 1); siblings.forEach((entry, i) => { entry.order = i; }); }
      if (action === 'add-price') item.prices.push({ label: '', usd: null, lbp: null });
      if (action === 'remove-price') item.prices.splice(index, 1);
      if (action === 'add-option') item.options.push('');
      if (action === 'remove-option') item.options.splice(index, 1);
      if (action === 'add-group') content.menu.groups.push({ id: id('group'), label: 'New group' });
      if (action === 'delete-group') content.menu.groups.splice(index, 1);
      if (action === 'group-up' || action === 'group-down') swap(content.menu.groups, index, action.endsWith('up') ? -1 : 1);
      if (action === 'add-category') { if (!content.menu.groups.length) content.menu.groups.push({ id: id('group'), label: 'Our menu' }); content.menu.categories.push({ id: id('category'), label: 'New category', groupId: content.menu.groups[0].id, order: content.menu.categories.length }); }
      if (action === 'delete-category') { const removed = content.menu.categories.splice(index, 1)[0]; content.menu.items = content.menu.items.filter(entry => entry.categoryId !== removed.id); if (categoryFilter === removed.id) categoryFilter = ''; }
      if (action === 'category-up' || action === 'category-down') { swap(content.menu.categories, index, action.endsWith('up') ? -1 : 1); content.menu.categories.forEach((entry, i) => { entry.order = i; }); }
      if (action === 'add-extra-group') { if (!content.menu.groups.length) content.menu.groups.push({ id: id('group'), label: 'Our menu' }); content.menu.extras.push({ id: id('extras'), label: 'New extras', groupIds: [content.menu.groups[0].id], categoryIds: [], items: [] }); }
      if (action === 'delete-extra-group') content.menu.extras.splice(index, 1);
      if (action === 'extra-group-up' || action === 'extra-group-down') swap(content.menu.extras, index, action.endsWith('up') ? -1 : 1);
      if (action === 'add-extra') content.menu.extras[index].items.push({ id: id('extra'), name: '', usd: null, lbp: null });
      if (action === 'delete-extra') content.menu.extras[sectionIndex].items.splice(index, 1);
      if (action === 'extra-up' || action === 'extra-down') swap(content.menu.extras[sectionIndex].items, index, action.endsWith('up') ? -1 : 1);
      if (action === 'delete-photo') content.photos[gallery].splice(index, 1);
      if (action === 'photo-up' || action === 'photo-down') swap(content.photos[gallery], index, action.endsWith('up') ? -1 : 1);
    }, action.includes('delete') || action.includes('remove') ? 'Removed from your draft. You can undo this before publishing.' : '');
    if (action === 'add-item' || action === 'duplicate-item') focusName();
  });
  editor.addEventListener('focusin', event => {
    if (event.target.dataset.path && !busy && !uploading) checkpoint();
  });
  editor.addEventListener('input', event => {
    const input = event.target;
    if (input.id === 'item-search') { query = input.value; $('#item-list').innerHTML = itemListHTML(); return; }
    if (!input.dataset.path || busy) return;
    let value = input.type === 'checkbox' ? input.checked : input.type === 'number' ? (input.value === '' ? null : Number(input.value)) : input.value;
    setPath(input.dataset.path, value); changed();
    if (tab === 'items' && /\.(name|usd|available)$/.test(input.dataset.path)) {
      $('#item-list').innerHTML = itemListHTML();
      if (input.dataset.path.endsWith('.name')) $('#item-editor-title').textContent = value || 'New menu item';
    }
  });
  editor.addEventListener('change', event => {
    const input = event.target;
    if (input.dataset.extraScope && !busy && !uploading) {
      const kind = input.dataset.extraScope, index = Number(input.dataset.section), value = input.value;
      mutate(() => {
        const section = content.menu.extras[index];
        section[kind] = input.checked ? [...new Set([...section[kind], value])] : section[kind].filter(id => id !== value);
        if (kind === 'groupIds' && input.checked) section.categoryIds = section.categoryIds.filter(id => content.menu.categories.find(category => category.id === id)?.groupId !== value);
      });
      [...editor.querySelectorAll('[data-extra-scope]')].find(control => control.dataset.extraScope === kind && Number(control.dataset.section) === index && control.value === value)?.focus({preventScroll:true});
      return;
    }
    if (event.target.id === 'category-filter') { categoryFilter = event.target.value; $('#item-list').innerHTML = itemListHTML(); }
    if (event.target.dataset.path?.endsWith('.categoryId')) renderItems();
    if (event.target.dataset.path?.startsWith('photos.') && event.target.dataset.path.endsWith('.url')) renderPhotos();
    if (event.target.id === 'photo-upload') uploadPhotos(event.target.files);
  });
  editor.addEventListener('submit', event => {
    if (event.target.id !== 'photo-url-form') return;
    event.preventDefault();
    const input = $('#photo-url');
    if (!input.reportValidity()) return;
    const url = input.value.trim();
    if (!/^https:\/\//i.test(url)) return notify('Use a complete image link beginning with https://.', true);
    mutate(() => content.photos[gallery].push({ id: id('photo'), url, alt: '', caption: '' }), 'Photo added to your draft. Add a caption and image description, then publish.');
  });
  async function uploadPhotos(fileList) {
    const files = [...fileList];
    if (!files.length || uploading) return;
    const targetGallery = gallery; checkpoint(); uploading = true; editor.inert = true; updateStatus();
    let added = 0; const failures = [];
    for (let i = 0; i < files.length; i++) {
      notify(`Uploading photo ${i + 1} of ${files.length}… Keep this page open.`);
      try {
        if (!files[i].type.startsWith('image/')) throw new Error('Choose an image file.');
        const photo = await window.LaStazioneContent.upload(files[i]);
        content.photos[targetGallery].push({ id: id('photo'), url: photo.url, alt: '', caption: '' }); added++; changed();
      } catch (error) { failures.push(`${files[i].name}: ${error.message || 'Upload failed.'}`); }
    }
    uploading = false; editor.inert = false; render(); persist();
    notify(`${added} ${added === 1 ? 'photo added' : 'photos added'} to your draft.${failures.length ? ' ' + failures.join(' ') : ' Add captions and descriptions, then publish.'}`, failures.length > 0);
  }
  function validate() {
    const menu = content.menu;
    if (!String(menu.title).trim()) return 'Give your menu a title in Categories & headings.';
    for (const group of menu.groups) if (!String(group.label).trim()) return 'Give every menu group a name in Categories & headings.';
    for (const category of menu.categories) {
      if (!String(category.label).trim()) return 'Give every category a name in Categories & headings.';
      if (!menu.groups.some(group => group.id === category.groupId)) return `Choose a menu group for “${category.label}”.`;
    }
    const validPrice = value => value === null || value === '' || (typeof value === 'number' && Number.isFinite(value) && value >= 0);
    for (const item of menu.items) {
      if (!String(item.name).trim()) { selectedId = item.id; tab = 'items'; return 'Give the new menu item a name before publishing.'; }
      if (!menu.categories.some(category => category.id === item.categoryId)) { selectedId = item.id; tab = 'items'; return `Choose a category for “${item.name}”.`; }
      if (!item.prices.length || item.prices.some(price => !validPrice(price.usd) || !validPrice(price.lbp) || (price.usd == null && price.lbp == null))) { selectedId = item.id; tab = 'items'; return `Add a valid non-negative USD or LBP amount for every price of “${item.name}”.`; }
    }
    for (const section of menu.extras) {
      if (!section.groupIds.length && !section.categoryIds.length) { tab = 'extras'; return 'Choose at least one category or subcategory for every extras section.'; }
      if (section.groupIds.some(id => !menu.groups.some(group => group.id === id)) || section.categoryIds.some(id => !menu.categories.some(category => category.id === id))) { tab = 'extras'; return 'Choose existing categories and subcategories for every extras section.'; }
      if (!String(section.label).trim()) { tab = 'extras'; return 'Give every extras section a name.'; }
      for (const extra of section.items) if (!String(extra.name).trim() || !validPrice(extra.usd) || !validPrice(extra.lbp) || (extra.usd == null && extra.lbp == null)) { tab = 'extras'; return 'Give every extra a name and at least one valid non-negative price.'; }
    }
    for (const key of ['hero', 'moments']) for (const photo of content.photos[key]) if (!/^https:\/\//i.test(photo.url) && !/^\/(?!\/)/.test(photo.url)) { tab = 'photos'; gallery = key; return 'Use an image link beginning with https:// for every external photo, or remove the photo.'; }
    return '';
  }
  async function publish() {
    if (!dirty || busy || uploading || conflicted) return;
    const error = validate();
    if (error) { render(); notify(error, true); $('#message').scrollIntoView({ block: 'nearest' }); return; }
    busy = true; activity = 'publish'; updateStatus(); editor.inert = true;
    try {
      const saved = await window.LaStazioneContent.save(clone(content), baseEtag);
      content = normalize(clone(saved)); published = clone(content); base = JSON.stringify(published); baseEtag = window.LaStazioneContent.getETag(); dirty = false; history = []; persist(); render();
      notify('Published. Your QR menu and the latest website now show these changes.');
    } catch (error) {
      conflicted = error.status === 409 || /409|conflict|another.*(tab|person)|changed/i.test(error.message || '');
      notify(conflicted ? 'Someone published another change while you were editing. Your draft is safe. Download a backup, then discard this draft to load the latest version before editing again.' : `Could not publish: ${error.message || 'The connection failed.'} Your draft is still here; try again.`, true);
    } finally { busy = false; activity = ''; editor.inert = false; updateStatus(); }
  }
  async function discard() {
    busy = true; activity = 'load'; updateStatus();
    try {
      const fresh = normalize(clone(await window.LaStazioneContent.refresh()));
      content = fresh; published = clone(fresh); base = JSON.stringify(published); baseEtag = window.LaStazioneContent.getETag(); dirty = false; conflicted = false; history = []; selectedId = null; persist(); render(); notify('Draft discarded. You are viewing the latest published content.');
    } catch (error) { notify(`Could not load the latest content: ${error.message || 'Check your connection.'} Your draft has been kept.`, true); }
    finally { busy = false; activity = ''; updateStatus(); }
  }
  function downloadBackup() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(content, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `La-Stazione-${dirty ? 'draft' : 'published'}-${new Date().toISOString().slice(0, 10)}.json`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  window.LaStazioneOwner = {
    get hasUnpublishedWork() { return dirty || busy || uploading; },
    persistDraft() { if (content) persist(); },
    downloadBackup,
    clearDraft() {
      clearTimeout(persistTimer);
      try {
        localStorage.removeItem(storageKey);
        if (accountEmail === 'lastazione10@gmail.com') localStorage.removeItem(legacyStorageKey);
      } catch { /* The in-memory draft is still cleared when storage is unavailable. */ }
      dirty = false; content = null; published = null; history = [];
    }
  };
  document.querySelectorAll('[data-tab]').forEach(button => button.addEventListener('click', () => { if (busy || uploading) return; tab = button.dataset.tab; render(); }));
  $('#undo').addEventListener('click', undo);
  $('#publish').addEventListener('click', publish);
  $('#export').addEventListener('click', downloadBackup);
  $('#import-trigger').addEventListener('click', () => $('#import').click());
  $('#discard').addEventListener('click', () => $('#discard-dialog').showModal());
  $('#discard-dialog').addEventListener('close', () => { if ($('#discard-dialog').returnValue === 'discard') discard(); });
  $('#import').addEventListener('change', async event => {
    const file = event.target.files[0]; if (!file) return;
    try {
      const backup = normalize(JSON.parse(await file.text()));
      mutate(() => { content = backup; selectedId = null; query = ''; categoryFilter = ''; }, 'Backup restored into your draft. Review it, then publish when you are ready.');
    } catch (error) { notify(`Could not restore this backup: ${error.message}`, true); }
    event.target.value = '';
  });
  window.addEventListener('pagehide', () => { if (content) persist(); });
  window.addEventListener('beforeunload', event => { if (busy || uploading || (dirty && storageFailed)) { event.preventDefault(); event.returnValue = ''; } });
  async function start() {
    try {
      if (!window.LaStazioneContent) throw new Error('The content service did not load. Reload this page.');
      content = normalize(clone(await window.LaStazioneContent.ready));
      published = clone(content); base = JSON.stringify(published); baseEtag = window.LaStazioneContent.getETag();
      try {
        if (accountEmail === 'lastazione10@gmail.com' && !localStorage.getItem(storageKey)) {
          const previousDraft = localStorage.getItem(legacyStorageKey);
          if (previousDraft) {
            localStorage.setItem(storageKey, previousDraft);
            localStorage.removeItem(legacyStorageKey);
          }
        }
        const cached = JSON.parse(localStorage.getItem(storageKey) || 'null');
        if (cached?.content) {
          const recovered = normalize(cached.content);
          if (JSON.stringify(recovered) !== base) {
            content = recovered; dirty = true; conflicted = Boolean((cached.base && cached.base !== base) || (cached.baseEtag && baseEtag && cached.baseEtag !== baseEtag));
            baseEtag = cached.baseEtag || (cached.base === base ? baseEtag : null);
            notify(conflicted ? 'A draft was recovered, but the published content has changed since it was started. Download your draft before discarding it to load the current version.' : 'Your unpublished draft was recovered from this device. Continue editing, or discard it to return to the published version.', conflicted);
          }
        }
      } catch { notify('The saved draft could not be recovered. The published content is loaded; you can restore a downloaded backup if you have one.', true); }
      content.menu.categories.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      render();
      if (!window.LaStazioneContent.connected) notify(`Shared storage is currently unavailable. ${window.LaStazioneContent.error?.message || ''} You can prepare a draft, but it has not been published. Reconnect before publishing.`, true, { label: 'Reconnect', run: reconnect });
    } catch (error) {
      editor.setAttribute('aria-busy', 'false'); editor.innerHTML = '<div class="empty-state"><h2>The workspace could not open.</h2><p>Your published website has not been changed.</p><button type="button" class="button primary" id="retry-load">Try again</button></div>';
      $('#save-state').textContent = 'Content unavailable'; $('#save-detail').textContent = 'Check the connection, then try again.';
      $('#retry-load').addEventListener('click', () => location.reload()); notify(error.message || 'Check your connection and reload.', true);
    }
  }
  async function reconnect() {
    try {
      const fresh = normalize(clone(await window.LaStazioneContent.refresh()));
      const freshBase = JSON.stringify(fresh);
      if (dirty && base !== freshBase) {
        conflicted = true;
        notify('Shared storage connected, but the published content differs from this draft. Download a backup, then discard the draft to load the latest content.', true);
      } else {
        if (!dirty) content = clone(fresh);
        published = clone(fresh); base = freshBase; baseEtag = window.LaStazioneContent.getETag(); conflicted = false;
        notify('Shared storage connected. Your draft is ready to review and publish.');
      }
      persist(); render();
    } catch (error) { notify(`Could not reconnect: ${error.message || 'Try again when you are online.'}`, true, { label: 'Reconnect', run: reconnect }); }
  }
  start();
})();
