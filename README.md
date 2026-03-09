# NeuroSpark — Brain Training

A browser-based cognitive brain training research platform built for ISEF 2025–2026.

## Project Structure

```
/
├── index.html    # Main HTML structure and page markup
├── styles.css    # All styles and CSS variables
├── app.js        # All game logic, auth, and data handling
└── README.md     # This file
```

## Running Locally

Just open `index.html` in any modern browser — no build step or server required.

```bash
# Or serve with Python for a local dev server:
python3 -m http.server 8080
# Then visit http://localhost:8080
```

## Deploying to Your Domain

### GitHub Pages
1. Push this repo to GitHub
2. Go to **Settings → Pages**
3. Set source to `main` branch, `/ (root)` folder
4. Your site will be live at `https://<your-username>.github.io/<repo-name>/`

### Custom Domain (GitHub Pages)
1. Add a `CNAME` file to the repo root containing your domain (e.g. `neurospark.yourdomain.com`)
2. In your DNS provider, add a CNAME record pointing to `<your-username>.github.io`
3. In GitHub Pages settings, enter your custom domain and enable "Enforce HTTPS"

### Any Static Host (Netlify, Vercel, Cloudflare Pages, etc.)
Upload or connect the repo — these hosts serve static files with zero configuration.

## Notes

- User data is stored in the browser via `localStorage` (no backend required)
- The researcher password is set in `app.js` — search for `RESEARCHER_PASSWORD` to change it
- The storage shim in `app.js` also supports the Claude.ai `window.storage` API if running inside an artifact
