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
