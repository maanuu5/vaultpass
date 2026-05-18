# Build Plan: Password Manager (HTML, CSS, JavaScript only)

## 1. Project goal

Build a simple, single-page password manager for an internship training project. A first-time user should understand it within seconds, and it should be easy to demo live.

**Hard constraints**
- Use only plain HTML, CSS and vanilla JavaScript. No frameworks, no libraries, no build tools, no npm, no backend.
- Store data in the browser with `localStorage`.
- Black and white only. No colors, no emojis, no icon libraries, no images. Use text labels on buttons instead of icons.
- Code must be readable and beginner-friendly: clear names, short functions, comments explaining each section.
- Must work by opening `index.html` directly in a browser.

## 2. File structure

```
password-manager/
  index.html
  style.css
  script.js
  README.md
```

Three code files only. Do not add more.

## 3. Features

### Required
1. **Add credential**: fields for Website name, Username, Password. Save to localStorage.
2. **Delete credential**: each entry has a Delete button, with a confirmation step before removal.
3. **Password visibility toggle**: password is masked by default. A "Show" / "Hide" button toggles it. Applies both in the add form and on each saved entry.
4. **Generate random password**: a "Generate" button next to the password field that fills it in.
5. **Search**: a search box that filters saved entries live as the user types (match on website name or username, case-insensitive).
6. **Copy to clipboard**: a "Copy" button on each entry. Button text briefly changes to "Copied" for about 1.5 seconds.

### Small additions (keep these, but do not add more)
7. **Edit credential**: an "Edit" button that loads the entry back into the form, with the submit button changing to "Update".
8. **Generator options**: a length slider (8 to 32, default 16) and checkboxes for uppercase, lowercase, numbers, symbols.
9. **Strength indicator**: a simple text label (Weak / Medium / Strong) with a thin black-and-white bar, based on length and variety of characters.
10. **Empty state**: when there are no entries, show a short message such as "No passwords saved yet. Add your first one above."
11. **Entry count**: small text like "3 saved" near the list heading.
12. **Form validation**: do not save if website, username or password is empty. Show a short inline message under the field.

### Explicitly out of scope
Master password, login, encryption, cloud sync, import/export, categories, dark/light theme switch, browser extensions.

## 4. Page layout

Single centered column, max width about 720px, generous whitespace.

1. **Header**: app name "Password Manager" and one short line below it: "Save and manage your logins in this browser."
2. **Add credential card**: heading "Add a credential", the three fields, the generator controls, the strength indicator and the Save button.
3. **Saved credentials section**: heading with entry count, search box, then the list of entries.
4. **Footer**: one small line: "Demo project. Do not store real passwords. Data is stored only in this browser."

### Entry row layout
Each saved entry is a bordered row showing:
- Website name (bold)
- Username (regular)
- Password (masked as dots by default)
- Buttons in a row: Show/Hide, Copy, Edit, Delete

On narrow screens the buttons wrap under the text.

## 5. Visual design (Vercel-style)

**Palette (only these)**
- Background: `#ffffff`
- Text: `#000000`
- Borders: `#000000` for emphasis, `#eaeaea` for subtle dividers
- Hover background for secondary buttons: `#f5f5f5`
- No other colors anywhere, including for errors, success and focus states.

**Typography**
- System font stack: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`
- Monospace stack for password text and generated passwords: `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`
- Sizes: title 28px, section headings 18px, body 14px to 15px, small text 12px.

**Components**
- Cards: white background, 1px solid `#eaeaea` border, 8px radius, 24px padding.
- Inputs: full width, 40px height, 1px solid `#eaeaea` border, 6px radius. On focus: border becomes `#000000`, no glow, no colored outline.
- Primary button (Save, Update): black background, white text, 6px radius, 40px height. On hover: invert (white background, black text, 1px black border).
- Secondary buttons (Show, Copy, Edit, Delete, Generate): white background, 1px black border, black text. On hover: `#f5f5f5` background.
- Delete confirmation: the Delete button changes to "Confirm?" on first click and reverts after 3 seconds if not clicked again. Do not use the browser `confirm()` popup.
- Errors and messages: plain black text with an "Error:" prefix instead of red color.
- Strength bar: 4px tall, `#eaeaea` track, black fill, width changes by strength level.
- Transitions: 150ms on border and background only. No other animations.

## 6. Data model

Store an array of objects under the localStorage key `passwordManagerEntries`:

```js
{
  id: "unique string, e.g. Date.now().toString()",
  website: "github.com",
  username: "manu@example.com",
  password: "the password",
  createdAt: 1731600000000
}
```

Show newest entries first.

## 7. JavaScript structure (script.js)

Organize the file into clearly commented sections, in this order:

1. **Constants and state**: storage key, `entries` array, `editingId` (null when not editing), element references via `document.getElementById`.
2. **Storage helpers**: `loadEntries()` and `saveEntries()`, each wrapped in try/catch so a corrupted localStorage value does not break the page.
3. **Password generator**: `generatePassword(length, options)`. Use `crypto.getRandomValues` rather than `Math.random`. Guarantee at least one character from each selected type. If no checkbox is selected, show a message and do not generate.
4. **Strength checker**: `getStrength(password)` returns a level and label. Simple scoring: length thresholds plus count of character types.
5. **Render functions**: `renderEntries()` builds the list from `entries` filtered by the search text. Build elements with `createElement` and `textContent`, never `innerHTML`, so user input cannot inject HTML.
6. **Actions**: `addOrUpdateEntry()`, `deleteEntry(id)`, `startEdit(id)`, `cancelEdit()`, `copyPassword(id, button)`, `togglePassword(id)`.
7. **Event listeners**: form submit, generate button, slider input, search input, and event delegation on the list container for Show/Copy/Edit/Delete.
8. **Init**: load entries, render, wire up listeners.

**Clipboard handling**: use `navigator.clipboard.writeText`. If it is unavailable or fails (for example when opened over `file://` in some browsers), fall back to a hidden textarea with `document.execCommand("copy")`. Never fail silently; show "Copy failed" on the button if both methods fail.

**Visibility state**: keep the "shown" state per entry in memory only (a Set of ids), never saved. Passwords are hidden again on every page load.

## 8. Behavior details

- Pressing Enter in the form submits it.
- After saving, clear the form, reset the strength bar and move focus back to the Website field.
- When editing, show a "Cancel" button next to "Update" and change the card heading to "Edit credential".
- Trim whitespace on website and username. Do not trim the password.
- If the same website and username already exist, show "Error: this website and username are already saved." and do not add a duplicate (unless editing that same entry).
- Search shows "No matches found." when the filter returns nothing but entries exist.
- The Generate button fills the password field and shows it as visible text so the user sees what was created.

## 9. Accessibility and usability

- Every input has a visible `<label>`.
- All buttons are real `<button>` elements with clear text and visible focus states (black 2px outline).
- Show/Hide button uses `aria-pressed`.
- Minimum tap target height of 36px on mobile.
- Layout works from 360px width up to desktop.
- Include `<meta name="viewport">` and `lang="en"`.

## 10. Security note

Passwords are stored in plain text in localStorage, which is acceptable for a training demo but not for real use. The agent must:
- Keep the footer line "Demo project. Do not store real passwords."
- Mention this limitation in the README.

## 11. README.md contents

- One-paragraph description
- How to run (open `index.html`)
- Feature list
- Known limitations (plain text storage, browser-only data)
- Short file structure explanation

## 12. Build order for the agent

1. Create `index.html` with all semantic structure and no styling.
2. Write `style.css` and check the layout at desktop and 360px width.
3. Write `script.js` section by section, testing each in the browser: storage, add, render, delete, show/hide, copy, search, generator, strength, edit.
4. Run the test checklist below.
5. Write the README.

## 13. Test checklist (agent must verify before finishing)

- Adding an entry with empty fields is blocked with a message.
- Entry survives a page refresh.
- Delete requires two clicks and removes only that entry.
- Show/Hide works per entry and in the form.
- Generate respects length and selected character types, and refuses when none are selected.
- Search filters live and is case-insensitive; clearing it restores the full list.
- Copy puts the exact password on the clipboard.
- Edit then Update changes the entry; Cancel restores the form.
- Duplicate website and username is rejected.
- Corrupted localStorage value does not crash the page.
- No color other than black, white and the allowed light greys appears anywhere, and no emojis or images are present.
- A password containing `<script>` or `"` displays as plain text and does not break the page.

## 14. Definition of done

The app opens from `index.html`, every required feature works, the UI is strictly black and white, the code is commented and readable by a beginner, and the README is complete.
