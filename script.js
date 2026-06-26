/**
 * Password Manager
 * Clean Bento-Style Password Manager
 *
 * Core Capabilities:
 * - Bento grid dashboard with live security health metrics
 * - CSPRNG Password Generator with presets and dynamic entropy calculation
 * - Dynamic website logo detection with resilient monogram fallback
 * - Real-time live search with category/health filter tabs
 * - Vault JSON Backup & Restore for seamless export/import
 * - Keyboard shortcuts (Ctrl+Enter to save, / to search, Esc to dismiss)
 * - Toast notification feedback system
 * - Full backward compatibility with passwordManagerEntries schema
 */

// ============================================================================
// 1. Constants and state
// ============================================================================

const STORAGE_KEY = "passwordManagerEntries";
const THEME_KEY = "vaultPassTheme";
const AUTH_SESSION_KEY = "vaultPassAuthSession";

// Master Demo Credentials
const DEMO_USER = "admin";
const DEMO_PASS = "admin123";

// Character sets for generator
const CHAR_SETS = {
  uppercase: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  lowercase: "abcdefghijklmnopqrstuvwxyz",
  numbers: "0123456789",
  symbols: "!@#$%^&*()_+-=[]{}|;:,.<>?"
};

// Application state
let entries = [];
let editingId = null;
const visiblePasswordIds = new Set();
let pendingDelete = null; // { id, timeoutId, button }
let currentGeneratedPassword = "";
let currentFilter = "all"; // 'all' | 'strong' | 'weak'

// DOM Element references - Theme & Top Actions
const htmlElement = document.documentElement;
const themeToggleBtn = document.getElementById("theme-toggle");
const themeIconMoon = document.getElementById("theme-icon-moon");
const themeIconSun = document.getElementById("theme-icon-sun");
const exportVaultBtn = document.getElementById("export-vault-btn");
const importVaultFile = document.getElementById("import-vault-file");
const lockVaultBtn = document.getElementById("lock-vault-btn");

// Auth & Screen elements
const loginScreen = document.getElementById("login-screen");
const vaultScreen = document.getElementById("vault-screen");
const loginForm = document.getElementById("login-form");
const loginUsername = document.getElementById("login-username");
const loginPassword = document.getElementById("login-password");
const toggleLoginPasswordBtn = document.getElementById("toggle-login-password");
const loginError = document.getElementById("login-error");
const autofillBtn = document.getElementById("autofill-btn");
const loginThemeToggleBtn = document.getElementById("login-theme-toggle");

// Form elements
const form = document.getElementById("credential-form");
const formHeading = document.getElementById("form-heading");
const editBadge = document.getElementById("edit-badge");
const websiteInput = document.getElementById("website-input");
const usernameInput = document.getElementById("username-input");
const passwordInput = document.getElementById("password-input");
const toggleFormPasswordBtn = document.getElementById("toggle-form-password");
const generateBtn = document.getElementById("generate-button");
const saveBtn = document.getElementById("save-button");
const cancelBtn = document.getElementById("cancel-button");

// Website Logo Preview Elements
const formLogoImg = document.getElementById("form-logo-img");
const formLogoFallback = document.getElementById("form-logo-fallback");

// Error elements
const websiteError = document.getElementById("website-error");
const usernameError = document.getElementById("username-error");
const passwordError = document.getElementById("password-error");
const formError = document.getElementById("form-error");
const generatorError = document.getElementById("generator-error");

// Strength elements
const strengthLabel = document.getElementById("strength-label");
const strengthBarFill = document.getElementById("strength-bar-fill");
const strengthProgressbar = document.getElementById("strength-progressbar");
const entropyHint = document.getElementById("entropy-hint");

// Generator card elements
const genPreviewText = document.getElementById("gen-preview-text");
const copyGenBtn = document.getElementById("copy-gen-btn");
const fillFormBtn = document.getElementById("fill-form-btn");
const genRefreshBtn = document.getElementById("gen-refresh-btn");
const lengthSlider = document.getElementById("length-slider");
const lengthDisplay = document.getElementById("length-display");
const optUppercase = document.getElementById("opt-uppercase");
const optLowercase = document.getElementById("opt-lowercase");
const optNumbers = document.getElementById("opt-numbers");
const optSymbols = document.getElementById("opt-symbols");

// Stats elements
const statTotal = document.getElementById("stat-total");
const statStrong = document.getElementById("stat-strong");
const statMedium = document.getElementById("stat-medium");
const statWeak = document.getElementById("stat-weak");

// Saved credentials elements
const searchInput = document.getElementById("search-input");
const entryCount = document.getElementById("entry-count");
const credentialsList = document.getElementById("credentials-list");

// ============================================================================
// 2. Storage & Theme helpers
// ============================================================================

/**
 * Loads entries from localStorage.
 * Wrapped in try/catch to safely handle corrupt data.
 * @returns {Array} Array of credential entry objects
 */
function loadEntries() {
  try {
    const rawData = localStorage.getItem(STORAGE_KEY);
    if (!rawData) {
      return [];
    }
    const parsed = JSON.parse(rawData);
    if (Array.isArray(parsed)) {
      // Ensure newest entries first
      return parsed.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    }
    return [];
  } catch (error) {
    console.error("Failed to load credentials from localStorage:", error);
    return [];
  }
}

/**
 * Persists entries array into localStorage.
 */
function saveEntries() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch (error) {
    console.error("Failed to save credentials to localStorage:", error);
  }
}

/**
 * Initializes and switches Dark/Light theme.
 */
function initTheme() {
  const savedTheme = localStorage.getItem(THEME_KEY) || "dark";
  applyTheme(savedTheme);

  const toggleHandler = () => {
    const current = htmlElement.getAttribute("data-theme") || "dark";
    const nextTheme = current === "dark" ? "light" : "dark";
    applyTheme(nextTheme);
    try {
      localStorage.setItem(THEME_KEY, nextTheme);
    } catch (e) {
      /* storage disabled */
    }
  };

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener("click", toggleHandler);
  }
  if (loginThemeToggleBtn) {
    loginThemeToggleBtn.addEventListener("click", toggleHandler);
  }
}

function applyTheme(theme) {
  htmlElement.setAttribute("data-theme", theme);
  const moonMain = document.getElementById("theme-icon-moon");
  const sunMain = document.getElementById("theme-icon-sun");
  const moonLogin = document.querySelector(".theme-icon-moon-login");
  const sunLogin = document.querySelector(".theme-icon-sun-login");

  if (theme === "dark") {
    if (moonMain) moonMain.style.display = "block";
    if (sunMain) sunMain.style.display = "none";
    if (moonLogin) moonLogin.style.display = "block";
    if (sunLogin) sunLogin.style.display = "none";
  } else {
    if (moonMain) moonMain.style.display = "none";
    if (sunMain) sunMain.style.display = "block";
    if (moonLogin) moonLogin.style.display = "none";
    if (sunLogin) sunLogin.style.display = "block";
  }
}

// ============================================================================
// 3. Authentication Helpers (Basic Login & Autofill)
// ============================================================================

/**
 * Checks current session state and displays login or vault accordingly.
 */
function checkAuthState() {
  let isAuthed = false;
  try {
    isAuthed = sessionStorage.getItem(AUTH_SESSION_KEY) === "true";
  } catch (e) {
    isAuthed = false;
  }

  if (isAuthed) {
    showVaultScreen();
  } else {
    showLoginScreen();
  }
}

function showLoginScreen() {
  if (loginScreen) loginScreen.style.display = "flex";
  if (vaultScreen) vaultScreen.style.display = "none";
  if (loginPassword) loginPassword.value = "";
  if (loginError) loginError.textContent = "";
}

function showVaultScreen() {
  if (loginScreen) loginScreen.style.display = "none";
  if (vaultScreen) vaultScreen.style.display = "flex";
  renderEntries();
  updateStats();
  updateFormLogoPreview();
}

/**
 * Populates demo credentials into login form for instant testing.
 */
function handleAutofill() {
  if (loginUsername) loginUsername.value = DEMO_USER;
  if (loginPassword) loginPassword.value = DEMO_PASS;
  if (loginError) loginError.textContent = "";
  showToast("Demo credentials autofilled!");
  const submitBtn = document.getElementById("login-submit-btn");
  if (submitBtn) submitBtn.focus();
}

/**
 * Validates master credentials and unlocks vault session.
 */
function handleLogin(e) {
  if (e) e.preventDefault();
  const u = loginUsername ? loginUsername.value.trim() : "";
  const p = loginPassword ? loginPassword.value : "";

  if (u === DEMO_USER && p === DEMO_PASS) {
    try {
      sessionStorage.setItem(AUTH_SESSION_KEY, "true");
    } catch (e) {}
    if (loginError) loginError.textContent = "";
    showVaultScreen();
    showToast("Vault Unlocked. Welcome, Admin!");
    if (websiteInput) websiteInput.focus();
  } else {
    if (loginError) {
      loginError.textContent = "Error: Invalid credentials. Click Autofill for demo access.";
    }
  }
}

/**
 * Locks current session and displays login screen.
 */
function handleLogout() {
  try {
    sessionStorage.removeItem(AUTH_SESSION_KEY);
  } catch (e) {}
  showLoginScreen();
  showToast("Vault session locked.");
}

// ============================================================================
// 3. Toast Notifications & Backup Helpers
// ============================================================================

/**
 * Displays a non-intrusive floating toast notification.
 */
function showToast(message) {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = "toast";

  const textEl = document.createElement("span");
  textEl.textContent = message;

  toast.appendChild(textEl);
  container.appendChild(toast);

  setTimeout(() => {
    if (toast.classList) {
      toast.classList.add("toast-fadeout");
    }
    setTimeout(() => {
      if (container.contains(toast)) {
        container.removeChild(toast);
      }
    }, 200);
  }, 2200);
}

/**
 * Exports vault data as an encrypted-ready JSON file backup.
 */
function exportVaultBackup() {
  if (entries.length === 0) {
    showToast("Vault is empty. Nothing to export.");
    return;
  }
  try {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(entries, null, 2));
    const downloadAnchor = document.createElement("a");
    const dateStr = new Date().toISOString().split("T")[0];
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `vaultpass-backup-${dateStr}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast("Vault backup downloaded successfully.");
  } catch (err) {
    console.error("Export failed:", err);
    showToast("Export failed.");
  }
}

/**
 * Restores vault from a JSON backup file.
 */
function importVaultBackup(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const imported = JSON.parse(e.target.result);
      if (!Array.isArray(imported)) {
        showToast("Error: Invalid backup file format.");
        return;
      }
      let added = 0;
      imported.forEach((item) => {
        if (item.website && item.username && item.password) {
          const exists = entries.some(
            (existing) =>
              existing.website.toLowerCase() === item.website.toLowerCase() &&
              existing.username.toLowerCase() === item.username.toLowerCase()
          );
          if (!exists) {
            entries.unshift({
              id: item.id || (Date.now().toString() + "-" + getSecureRandomInt(1000000)),
              website: item.website,
              username: item.username,
              password: item.password,
              createdAt: item.createdAt || Date.now()
            });
            added++;
          }
        }
      });
      saveEntries();
      renderEntries();
      showToast(`Restored ${added} new credential(s).`);
    } catch (err) {
      console.error("Import failed:", err);
      showToast("Error reading backup file.");
    }
  };
  reader.readAsText(file);
}

// ============================================================================
// 4. Domain & Favicon Logo Helpers
// ============================================================================

/**
 * Cleans user input to extract core domain name.
 * Handles protocols, www, subpaths, queries, and ports.
 * @param {string} url User input (e.g. 'https://github.com/login')
 * @returns {string} Clean hostname (e.g. 'github.com')
 */
function extractDomain(url) {
  if (!url) return "";
  let clean = url.trim().toLowerCase();
  clean = clean.replace(/^(https?:\/\/)?(www\.)?/, "");
  clean = clean.split("/")[0].split("?")[0].split(":")[0];
  return clean;
}

/**
 * Generates Google Favicon URL for a domain (64x64 high-res).
 * @param {string} domain Clean domain name
 * @returns {string} URL string
 */
function getFaviconUrl(domain) {
  if (!domain) return "";
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;
}

/**
 * Updates live logo preview next to the Website input field.
 */
function updateFormLogoPreview() {
  if (!formLogoImg || !formLogoFallback) return;

  const domain = extractDomain(websiteInput.value);

  if (domain && domain.includes(".")) {
    formLogoImg.src = getFaviconUrl(domain);
    formLogoImg.style.display = "block";
    formLogoFallback.style.display = "none";

    formLogoImg.onerror = () => {
      formLogoImg.style.display = "none";
      formLogoFallback.style.display = "block";
      formLogoFallback.textContent = domain.charAt(0).toUpperCase() || "W";
    };
  } else {
    formLogoImg.style.display = "none";
    formLogoFallback.style.display = "block";
    formLogoFallback.textContent = domain ? domain.charAt(0).toUpperCase() : "W";
  }
}

// ============================================================================
// 5. Password Generator & Strength Checker
// ============================================================================

/**
 * Cryptographically secure integer generator [0, max - 1].
 */
function getSecureRandomInt(max) {
  if (max <= 0) return 0;
  const buffer = new Uint32Array(1);
  window.crypto.getRandomValues(buffer);
  return buffer[0] % max;
}

/**
 * Generates a password string according to length and options.
 * Guarantees representation from each checked type.
 */
function generatePassword(length, options) {
  const activeSets = [];

  if (options.uppercase) activeSets.push(CHAR_SETS.uppercase);
  if (options.lowercase) activeSets.push(CHAR_SETS.lowercase);
  if (options.numbers) activeSets.push(CHAR_SETS.numbers);
  if (options.symbols) activeSets.push(CHAR_SETS.symbols);

  if (activeSets.length === 0) {
    return null;
  }

  const resultChars = [];

  // Guarantee at least one character from each selected set
  activeSets.forEach((charSet) => {
    const randomIndex = getSecureRandomInt(charSet.length);
    resultChars.push(charSet[randomIndex]);
  });

  const combinedPool = activeSets.join("");

  while (resultChars.length < length) {
    const randomIndex = getSecureRandomInt(combinedPool.length);
    resultChars.push(combinedPool[randomIndex]);
  }

  // Fisher-Yates shuffle
  for (let i = resultChars.length - 1; i > 0; i--) {
    const j = getSecureRandomInt(i + 1);
    const temp = resultChars[i];
    resultChars[i] = resultChars[j];
    resultChars[j] = temp;
  }

  return resultChars.join("");
}

/**
 * Evaluates password strength based on length and character types.
 */
function getStrength(password) {
  if (!password || password.length === 0) {
    return { label: "None", percent: 0, score: 0 };
  }

  let varietyCount = 0;
  if (/[a-z]/.test(password)) varietyCount++;
  if (/[A-Z]/.test(password)) varietyCount++;
  if (/[0-9]/.test(password)) varietyCount++;
  if (/[^a-zA-Z0-9]/.test(password)) varietyCount++;

  const len = password.length;

  if (len >= 12 && varietyCount >= 3) {
    return { label: "Strong", percent: 100, score: 3 };
  } else if (len >= 8 && varietyCount >= 2) {
    return { label: "Medium", percent: 66, score: 2 };
  } else {
    return { label: "Weak", percent: 33, score: 1 };
  }
}

/**
 * Updates visual strength indicator bar and labels.
 */
function updateStrengthDisplay(password) {
  const strength = getStrength(password);
  strengthLabel.textContent = strength.label;
  strengthLabel.className = "strength-label strength-" + strength.label.toLowerCase();
  strengthBarFill.style.width = strength.percent + "%";
  strengthProgressbar.setAttribute("aria-valuenow", String(strength.percent));

  if (entropyHint) {
    if (!password) {
      entropyHint.textContent = "";
    } else {
      const bits = Math.round(password.length * 4.5);
      entropyHint.textContent = `~${bits} bits entropy`;
    }
  }

  if (strength.label === "Strong") {
    strengthBarFill.style.backgroundColor = "var(--success)";
  } else if (strength.label === "Medium") {
    strengthBarFill.style.backgroundColor = "var(--warning)";
  } else if (strength.label === "Weak") {
    strengthBarFill.style.backgroundColor = "var(--danger)";
  } else {
    strengthBarFill.style.backgroundColor = "var(--text-faint)";
  }
}

/**
 * Updates stats counter banner in Bento Grid.
 */
function updateStats() {
  if (!statTotal) return;

  const total = entries.length;
  let strongCount = 0;
  let mediumCount = 0;
  let weakCount = 0;

  entries.forEach((item) => {
    const score = getStrength(item.password).score;
    if (score === 3) strongCount++;
    else if (score === 2) mediumCount++;
    else weakCount++;
  });

  statTotal.textContent = String(total);
  statStrong.textContent = String(strongCount);
  statMedium.textContent = String(mediumCount);
  statWeak.textContent = String(weakCount);
}

// ============================================================================
// 6. Render functions
// ============================================================================

/**
 * Re-renders the saved credentials list with website logos, tags, and actions.
 */
function renderEntries() {
  while (credentialsList.firstChild) {
    credentialsList.removeChild(credentialsList.firstChild);
  }

  resetPendingDelete();
  updateStats();

  const totalCount = entries.length;
  entryCount.textContent = totalCount === 1 ? "1 saved" : `${totalCount} saved`;

  const query = searchInput.value.trim().toLowerCase();

  // If no credentials saved at all
  if (totalCount === 0) {
    const emptyState = document.createElement("div");
    emptyState.className = "empty-state";

    const emptyIcon = document.createElement("div");
    emptyIcon.className = "empty-state-icon";
    emptyIcon.innerHTML = `
      <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
      </svg>
    `;

    const emptyTitle = document.createElement("p");
    emptyTitle.className = "empty-state-title";
    emptyTitle.textContent = "Your vault is empty";

    const emptyDesc = document.createElement("p");
    emptyDesc.className = "empty-state-desc";
    emptyDesc.textContent = "No passwords saved yet. Add your first one above.";

    emptyState.appendChild(emptyIcon);
    emptyState.appendChild(emptyTitle);
    emptyState.appendChild(emptyDesc);
    credentialsList.appendChild(emptyState);
    return;
  }

  // Filter entries by search query and category filter
  const filteredEntries = entries.filter((entry) => {
    const matchesWebsite = entry.website.toLowerCase().includes(query);
    const matchesUsername = entry.username.toLowerCase().includes(query);
    const matchesQuery = matchesWebsite || matchesUsername;

    if (!matchesQuery) return false;

    if (currentFilter === "strong") {
      return getStrength(entry.password).label === "Strong";
    } else if (currentFilter === "weak") {
      return getStrength(entry.password).label !== "Strong";
    }
    return true;
  });

  // If search yields no results
  if (filteredEntries.length === 0) {
    const emptyState = document.createElement("div");
    emptyState.className = "empty-state";

    const emptyTitle = document.createElement("p");
    emptyTitle.className = "empty-state-title";
    emptyTitle.textContent = "No matches found.";

    const emptyDesc = document.createElement("p");
    emptyDesc.className = "empty-state-desc";
    emptyDesc.textContent = "Try searching for a different website name or username.";

    emptyState.appendChild(emptyTitle);
    emptyState.appendChild(emptyDesc);
    credentialsList.appendChild(emptyState);
    return;
  }

  // Build each credential card
  filteredEntries.forEach((entry) => {
    const row = document.createElement("div");
    row.className = "entry-row";
    row.dataset.id = entry.id;

    // Left Container: Logo + Details
    const mainInfo = document.createElement("div");
    mainInfo.className = "entry-main-info";

    // Website Logo Box with Dynamic Favicon & Monogram Fallback
    const domain = extractDomain(entry.website);
    const initial = (domain || entry.website || "W").charAt(0).toUpperCase();

    const logoBox = document.createElement("div");
    logoBox.className = "entry-logo-box";
    logoBox.setAttribute("aria-hidden", "true");

    const logoImg = document.createElement("img");
    logoImg.className = "entry-logo-img";
    logoImg.alt = "";
    logoImg.loading = "lazy";
    logoImg.src = getFaviconUrl(domain);

    const logoFallback = document.createElement("div");
    logoFallback.className = "entry-logo-fallback";
    logoFallback.textContent = initial;
    logoFallback.style.display = "none";

    logoImg.onerror = () => {
      logoImg.style.display = "none";
      logoFallback.style.display = "flex";
    };

    logoBox.appendChild(logoImg);
    logoBox.appendChild(logoFallback);

    // Details Column (Website, Strength Tag, Username, Password)
    const details = document.createElement("div");
    details.className = "entry-details";

    const websiteRow = document.createElement("div");
    websiteRow.className = "entry-website-row";

    const websiteEl = document.createElement("span");
    websiteEl.className = "entry-website";
    websiteEl.textContent = entry.website;
    websiteRow.appendChild(websiteEl);

    // Strength pill badge
    const strengthInfo = getStrength(entry.password);
    const strengthBadge = document.createElement("span");
    strengthBadge.className = `entry-strength-badge badge-${strengthInfo.label.toLowerCase()}`;
    strengthBadge.textContent = strengthInfo.label;
    websiteRow.appendChild(strengthBadge);

    const userBadge = document.createElement("div");
    userBadge.className = "entry-username-badge";

    const userText = document.createElement("span");
    userText.textContent = entry.username;

    // Quick Copy Username Button
    const copyUserBtn = document.createElement("button");
    copyUserBtn.type = "button";
    copyUserBtn.className = "btn-copy-user";
    copyUserBtn.title = "Copy username";
    copyUserBtn.dataset.action = "copy-username";
    copyUserBtn.dataset.id = entry.id;
    copyUserBtn.innerHTML = `
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
      </svg>
    `;

    userBadge.appendChild(userText);
    userBadge.appendChild(copyUserBtn);

    const pwBox = document.createElement("div");
    pwBox.className = "entry-password-box";

    const passwordEl = document.createElement("span");
    passwordEl.className = "entry-password";
    const isVisible = visiblePasswordIds.has(entry.id);
    passwordEl.textContent = isVisible ? entry.password : "•".repeat(entry.password.length);

    pwBox.appendChild(passwordEl);

    details.appendChild(websiteRow);
    details.appendChild(userBadge);
    details.appendChild(pwBox);

    mainInfo.appendChild(logoBox);
    mainInfo.appendChild(details);

    // Right Container: Action Buttons
    const actions = document.createElement("div");
    actions.className = "entry-actions";

    // Show/Hide Toggle
    const toggleBtn = document.createElement("button");
    toggleBtn.type = "button";
    toggleBtn.className = "btn btn-secondary action-toggle";
    toggleBtn.dataset.action = "toggle";
    toggleBtn.dataset.id = entry.id;
    toggleBtn.textContent = isVisible ? "Hide" : "Show";
    toggleBtn.setAttribute("aria-pressed", isVisible ? "true" : "false");

    // Copy Password Button
    const copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.className = "btn btn-secondary action-copy";
    copyBtn.dataset.action = "copy";
    copyBtn.dataset.id = entry.id;
    copyBtn.textContent = "Copy";

    // Edit Button
    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "btn btn-secondary action-edit";
    editBtn.dataset.action = "edit";
    editBtn.dataset.id = entry.id;
    editBtn.textContent = "Edit";

    // Delete Button
    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "btn btn-secondary action-delete";
    deleteBtn.dataset.action = "delete";
    deleteBtn.dataset.id = entry.id;
    deleteBtn.textContent = "Delete";

    actions.appendChild(toggleBtn);
    actions.appendChild(copyBtn);
    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);

    row.appendChild(mainInfo);
    row.appendChild(actions);

    credentialsList.appendChild(row);
  });
}

// ============================================================================
// 7. Actions
// ============================================================================

function clearErrors() {
  websiteError.textContent = "";
  usernameError.textContent = "";
  passwordError.textContent = "";
  formError.textContent = "";
  generatorError.textContent = "";
}

/**
 * Validates form inputs and adds or updates credential entry.
 */
function addOrUpdateEntry() {
  clearErrors();

  const website = websiteInput.value.trim();
  const username = usernameInput.value.trim();
  const password = passwordInput.value; // Do not trim password

  let hasError = false;

  if (!website) {
    websiteError.textContent = "Error: website is required.";
    hasError = true;
  }

  if (!username) {
    usernameError.textContent = "Error: username is required.";
    hasError = true;
  }

  if (!password) {
    passwordError.textContent = "Error: password is required.";
    hasError = true;
  }

  if (hasError) return;

  // Duplicate check
  const isDuplicate = entries.some((item) => {
    const isSameWebsite = item.website.toLowerCase() === website.toLowerCase();
    const isSameUsername = item.username.toLowerCase() === username.toLowerCase();
    const isDifferentId = editingId === null || item.id !== editingId;
    return isSameWebsite && isSameUsername && isDifferentId;
  });

  if (isDuplicate) {
    formError.textContent = "Error: this website and username are already saved.";
    return;
  }

  if (editingId !== null) {
    // Update existing
    const targetIndex = entries.findIndex((item) => item.id === editingId);
    if (targetIndex !== -1) {
      entries[targetIndex].website = website;
      entries[targetIndex].username = username;
      entries[targetIndex].password = password;
    }
    showToast("Credential updated successfully!");
    cancelEdit();
  } else {
    // Add new (newest first)
    const newEntry = {
      id: Date.now().toString() + "-" + getSecureRandomInt(1000000),
      website: website,
      username: username,
      password: password,
      createdAt: Date.now()
    };
    entries.unshift(newEntry);
    showToast("Credential saved to vault!");
    resetForm();
  }

  saveEntries();
  renderEntries();
  websiteInput.focus();
}

/**
 * Prepares form for editing an existing entry.
 */
function startEdit(id) {
  const entry = entries.find((item) => item.id === id);
  if (!entry) return;

  editingId = id;
  clearErrors();

  websiteInput.value = entry.website;
  usernameInput.value = entry.username;
  passwordInput.value = entry.password;

  updateFormLogoPreview();
  updateStrengthDisplay(entry.password);

  formHeading.textContent = "Edit credential";
  if (editBadge) editBadge.style.display = "inline-block";
  saveBtn.textContent = "Update";
  cancelBtn.style.display = "inline-flex";

  form.scrollIntoView({ behavior: "smooth", block: "start" });
  websiteInput.focus();
}

/**
 * Cancels editing mode.
 */
function cancelEdit() {
  editingId = null;
  formHeading.textContent = "Add a credential";
  if (editBadge) editBadge.style.display = "none";
  saveBtn.textContent = "Save to Vault";
  cancelBtn.style.display = "none";
  resetForm();
  websiteInput.focus();
}

/**
 * Clears form fields and resets previews.
 */
function resetForm() {
  form.reset();
  clearErrors();

  passwordInput.type = "password";
  toggleFormPasswordBtn.textContent = "Show";
  toggleFormPasswordBtn.setAttribute("aria-pressed", "false");

  lengthSlider.value = "16";
  lengthDisplay.textContent = "16";
  optUppercase.checked = true;
  optLowercase.checked = true;
  optNumbers.checked = true;
  optSymbols.checked = true;

  updatePresetButtons("16");
  updateFormLogoPreview();
  updateStrengthDisplay("");
}

/**
 * Toggles visibility of saved entry password.
 */
function togglePasswordVisibility(id) {
  if (visiblePasswordIds.has(id)) {
    visiblePasswordIds.delete(id);
  } else {
    visiblePasswordIds.add(id);
  }
  renderEntries();
}

/**
 * Generic clipboard copy helper with fallback for non-https/file contexts.
 */
function copyToClipboard(text, onSuccess, onFailure) {
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(onSuccess).catch(() => {
      fallbackCopyText(text, onSuccess, onFailure);
    });
  } else {
    fallbackCopyText(text, onSuccess, onFailure);
  }
}

function fallbackCopyText(text, onSuccess, onFailure) {
  try {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.setAttribute("readonly", "");
    textArea.style.position = "fixed";
    textArea.style.left = "-9999px";
    textArea.style.top = "-9999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    const ok = document.execCommand("copy");
    document.body.removeChild(textArea);

    if (ok) onSuccess();
    else onFailure(new Error("execCommand failed"));
  } catch (err) {
    onFailure(err);
  }
}

/**
 * Copies password for a specific saved entry.
 */
function copyPassword(id, button) {
  const entry = entries.find((item) => item.id === id);
  if (!entry) return;

  const originalText = "Copy";

  copyToClipboard(
    entry.password,
    () => {
      button.textContent = "Copied";
      showToast("Password copied to clipboard");
      setTimeout(() => {
        if (document.body.contains(button)) {
          button.textContent = originalText;
        }
      }, 1500);
    },
    (err) => {
      console.error("Clipboard copy failed:", err);
      button.textContent = "Copy failed";
      setTimeout(() => {
        if (document.body.contains(button)) {
          button.textContent = originalText;
        }
      }, 1500);
    }
  );
}

/**
 * Copies username for a specific saved entry.
 */
function copyUsername(id, button) {
  const entry = entries.find((item) => item.id === id);
  if (!entry) return;

  const originalHtml = button.innerHTML;
  copyToClipboard(
    entry.username,
    () => {
      showToast("Username copied.");
      button.textContent = "Copied";
      setTimeout(() => {
        if (document.body.contains(button)) {
          button.innerHTML = originalHtml;
        }
      }, 1500);
    },
    (err) => {
      console.error("Username copy failed:", err);
    }
  );
}

/**
 * Resets any active delete confirmation.
 */
function resetPendingDelete() {
  if (pendingDelete) {
    clearTimeout(pendingDelete.timeoutId);
    if (pendingDelete.button && document.body.contains(pendingDelete.button)) {
      pendingDelete.button.textContent = "Delete";
    }
    pendingDelete = null;
  }
}

/**
 * 2-step deletion handler: 'Confirm?' on click 1, executes removal on click 2.
 */
function handleDeleteClick(id, button) {
  if (pendingDelete && pendingDelete.id === id) {
    clearTimeout(pendingDelete.timeoutId);
    pendingDelete = null;

    if (editingId === id) {
      cancelEdit();
    }

    visiblePasswordIds.delete(id);
    entries = entries.filter((item) => item.id !== id);

    saveEntries();
    renderEntries();
    showToast("Credential deleted from vault.");
  } else {
    resetPendingDelete();

    button.textContent = "Confirm?";
    const timeoutId = setTimeout(() => {
      if (pendingDelete && pendingDelete.id === id) {
        button.textContent = "Delete";
        pendingDelete = null;
      }
    }, 3000);

    pendingDelete = { id, timeoutId, button };
  }
}

/**
 * Generates and displays a password inside the Generator Bento Card.
 */
function refreshGeneratorPreview() {
  generatorError.textContent = "";

  const length = parseInt(lengthSlider.value, 10);
  const options = {
    uppercase: optUppercase.checked,
    lowercase: optLowercase.checked,
    numbers: optNumbers.checked,
    symbols: optSymbols.checked
  };

  const newPassword = generatePassword(length, options);

  if (newPassword === null) {
    generatorError.textContent = "Error: select at least one character type.";
    return null;
  }

  currentGeneratedPassword = newPassword;
  if (genPreviewText) {
    genPreviewText.textContent = newPassword;
  }
  return newPassword;
}

function updatePresetButtons(val) {
  document.querySelectorAll(".preset-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.len === String(val));
  });
}

// ============================================================================
// 8. Event listeners
// ============================================================================

function wireEventListeners() {
  // Form submission
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    addOrUpdateEntry();
  });

  // Cancel edit button
  cancelBtn.addEventListener("click", () => {
    cancelEdit();
  });

  // Form password mask toggle
  toggleFormPasswordBtn.addEventListener("click", () => {
    const isCurrentlyPassword = passwordInput.type === "password";
    passwordInput.type = isCurrentlyPassword ? "text" : "password";
    toggleFormPasswordBtn.textContent = isCurrentlyPassword ? "Hide" : "Show";
    toggleFormPasswordBtn.setAttribute("aria-pressed", isCurrentlyPassword ? "true" : "false");
  });

  // Dynamic strength calculation on password input
  passwordInput.addEventListener("input", () => {
    clearErrors();
    updateStrengthDisplay(passwordInput.value);
  });

  // Live logo preview on website input
  websiteInput.addEventListener("input", () => {
    websiteError.textContent = "";
    formError.textContent = "";
    updateFormLogoPreview();
  });

  usernameInput.addEventListener("input", () => {
    usernameError.textContent = "";
    formError.textContent = "";
  });

  // Generator card: length slider updates
  lengthSlider.addEventListener("input", () => {
    lengthDisplay.textContent = lengthSlider.value;
    updatePresetButtons(lengthSlider.value);
    refreshGeneratorPreview();
  });

  // Generator preset pills (12, 16, 20, 24)
  document.querySelectorAll(".preset-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const len = btn.dataset.len;
      lengthSlider.value = len;
      lengthDisplay.textContent = len;
      updatePresetButtons(len);
      refreshGeneratorPreview();
    });
  });

  [optUppercase, optLowercase, optNumbers, optSymbols].forEach((cb) => {
    cb.addEventListener("change", () => {
      refreshGeneratorPreview();
    });
  });

  // Generator card buttons
  if (genRefreshBtn) {
    genRefreshBtn.addEventListener("click", () => {
      refreshGeneratorPreview();
    });
  }

  if (fillFormBtn) {
    fillFormBtn.addEventListener("click", () => {
      const pw = currentGeneratedPassword || refreshGeneratorPreview();
      if (!pw) return;

      passwordInput.value = pw;
      passwordInput.type = "text";
      toggleFormPasswordBtn.textContent = "Hide";
      toggleFormPasswordBtn.setAttribute("aria-pressed", "true");
      updateStrengthDisplay(pw);
      passwordError.textContent = "";

      showToast("Applied to form!");
    });
  }

  if (copyGenBtn) {
    copyGenBtn.addEventListener("click", () => {
      const pw = currentGeneratedPassword || refreshGeneratorPreview();
      if (!pw) return;

      copyToClipboard(
        pw,
        () => {
          showToast("Generated password copied.");
          const original = copyGenBtn.textContent;
          copyGenBtn.textContent = "Copied";
          setTimeout(() => {
            copyGenBtn.textContent = original;
          }, 1500);
        },
        () => {}
      );
    });
  }

  // Quick form generate button
  generateBtn.addEventListener("click", () => {
    const pw = refreshGeneratorPreview();
    if (!pw) return;

    passwordInput.value = pw;
    passwordInput.type = "text";
    toggleFormPasswordBtn.textContent = "Hide";
    toggleFormPasswordBtn.setAttribute("aria-pressed", "true");

    updateStrengthDisplay(pw);
    passwordError.textContent = "";
  });

  // Live search
  searchInput.addEventListener("input", () => {
    renderEntries();
  });

  // Filter tabs (All, Strong, Weak)
  document.querySelectorAll(".filter-pill").forEach((pill) => {
    pill.addEventListener("click", () => {
      document.querySelectorAll(".filter-pill").forEach((p) => p.classList.remove("active"));
      pill.classList.add("active");
      currentFilter = pill.dataset.filter || "all";
      renderEntries();
    });
  });

  // Vault Backup & Restore
  if (exportVaultBtn) {
    exportVaultBtn.addEventListener("click", () => {
      exportVaultBackup();
    });
  }

  if (importVaultFile) {
    importVaultFile.addEventListener("change", (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) {
        importVaultBackup(file);
      }
      e.target.value = "";
    });
  }

  // Global Keyboard Shortcuts (Professional UX)
  document.addEventListener("keydown", (e) => {
    // Focus search on '/' or 'Ctrl+K' when not in an input
    if ((e.key === "/" || (e.ctrlKey && e.key.toLowerCase() === "k")) && document.activeElement.tagName !== "INPUT") {
      e.preventDefault();
      searchInput.focus();
      return;
    }

    // Ctrl+Enter inside form submits
    if (e.ctrlKey && e.key === "Enter") {
      if (document.activeElement && form.contains(document.activeElement)) {
        e.preventDefault();
        addOrUpdateEntry();
        return;
      }
    }

    // Escape clears search or cancels edit
    if (e.key === "Escape") {
      if (editingId !== null) {
        cancelEdit();
      } else if (document.activeElement === searchInput) {
        searchInput.value = "";
        searchInput.blur();
        renderEntries();
      }
    }
  });

  // Login & Authentication Listeners
  if (autofillBtn) {
    autofillBtn.addEventListener("click", handleAutofill);
  }

  if (loginForm) {
    loginForm.addEventListener("submit", handleLogin);
  }

  if (lockVaultBtn) {
    lockVaultBtn.addEventListener("click", handleLogout);
  }

  if (toggleLoginPasswordBtn && loginPassword) {
    toggleLoginPasswordBtn.addEventListener("click", () => {
      const isPass = loginPassword.type === "password";
      loginPassword.type = isPass ? "text" : "password";
      toggleLoginPasswordBtn.textContent = isPass ? "Hide" : "Show";
      toggleLoginPasswordBtn.setAttribute("aria-pressed", isPass ? "true" : "false");
    });
  }

  // Credential list event delegation
  credentialsList.addEventListener("click", (e) => {
    const target = e.target.closest("button");
    if (!target) return;

    const action = target.dataset.action;
    const id = target.dataset.id;
    if (!action || !id) return;

    if (action === "toggle") {
      togglePasswordVisibility(id);
    } else if (action === "copy") {
      copyPassword(id, target);
    } else if (action === "copy-username") {
      copyUsername(id, target);
    } else if (action === "edit") {
      startEdit(id);
    } else if (action === "delete") {
      handleDeleteClick(id, target);
    }
  });
}

// ============================================================================
// 9. Init
// ============================================================================

function init() {
  initTheme();
  entries = loadEntries();
  wireEventListeners();
  updateStrengthDisplay("");
  refreshGeneratorPreview();
  checkAuthState();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
