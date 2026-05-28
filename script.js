const STORAGE_KEY = 'vaultpass_entries';

function loadEntries() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    return [];
  }
}

function saveEntries(entries) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

let entries = loadEntries();

function handleFormSubmit(e) {
  e.preventDefault();
  const website = document.getElementById('website-input').value.trim();
  const username = document.getElementById('username-input').value.trim();
  const password = document.getElementById('password-input').value;
  if (!website || !username || !password) return;

  const newEntry = {
    id: Date.now().toString(),
    website,
    username,
    password,
    createdAt: new Date().toISOString()
  };
  entries.push(newEntry);
  saveEntries(entries);
}

function renderList() {
  const container = document.getElementById('credential-list');
  if (!container) return;
  container.innerHTML = entries.map(item => `
    <div class="entry-item" data-id="${item.id}">
      <span class="entry-site">${item.website}</span>
      <span class="entry-user">${item.username}</span>
      <span class="entry-pw" data-masked="true">••••••••</span>
    </div>
  `).join('');
}

function toggleItemPasswordMask(id) {
  const el = document.querySelector(`[data-id="${id}"] .entry-pw`);
  if (!el) return;
  const isMasked = el.getAttribute('data-masked') === 'true';
  const entry = entries.find(e => e.id === id);
  if (!entry) return;
  el.textContent = isMasked ? entry.password : '••••••••';
  el.setAttribute('data-masked', isMasked ? 'false' : 'true');
}

function deleteEntryWithConfirm(id, buttonEl) {
  if (buttonEl.dataset.confirming === 'true') {
    entries = entries.filter(e => e.id !== id);
    saveEntries(entries);
    renderList();
  } else {
    buttonEl.dataset.confirming = 'true';
    buttonEl.textContent = 'Confirm Delete?';
  }
}
