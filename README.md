# NeuroSpark — Brain Training

A browser-based cognitive brain training research platform built for ISEF 2025–2026.

## Project Structure

```
/
├── index.html    # Main HTML structure and page markup
├── styles.css    # All styles and CSS variables
├── app.js        # All game logic, auth, Firebase storage
└── README.md     # This file
```

## Running Locally

Just open `index.html` in any modern browser — no build step required.

## Firebase Setup (Required for cross-device data)

1. Go to https://console.firebase.google.com
2. Open your **NeuroSpark** project
3. Enable **Firestore Database** (Build → Firestore → Create database → Test mode)
4. Your config is already filled in at the top of `app.js`

## Deploying to GitHub Pages

1. Push all files to GitHub (index.html, styles.css, app.js, README.md)
2. Go to **Settings → Pages**
3. Set source to `main` branch, `/ (root)` folder
4. Your site will be live at `https://<username>.github.io/<repo>/`

## Researcher Login

- Password: `research2024`
- The password is stored as a SHA-256 hash in `app.js` for security

## Notes

- All participant data saves to **Firebase Firestore** — visible across all devices
- Falls back to localStorage automatically if Firebase is unavailable
- Participant play limit: 3 games per game type per account
