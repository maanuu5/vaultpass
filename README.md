# Password Manager

A simple, client-side password manager built with plain HTML, CSS, and JavaScript. It saves credentials in the browser using localStorage, so no server or account setup is needed.

## Features

- Add and save website logins (website, username, password)
- Website icon detection with fallback initials
- Built-in password generator with length and character options
- Live search by website name or username
- Password strength indicator (weak, moderate, strong)
- Masked passwords with show/hide toggle
- Copy password or username to clipboard
- Export vault backup to JSON and restore from backup
- Two-step confirmation for deleting entries
- Simple sign-in screen with demo credentials

## Demo Login

- **Username**: admin
- **Password**: admin123

You can also click the Autofill button on the sign-in screen to fill the fields automatically.

## How to Run

Just open `index.html` in any web browser.

## Tech

- HTML5
- CSS3 (Bento grid layout, black and white theme)
- Vanilla JavaScript (Web Crypto API, localStorage)
