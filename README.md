# A2B Timesheet GitHub Pages App

This is the mobile-first frontend for GitHub Pages.

## Files

- `index.html`
- `styles.css`
- `app.js`

## Backend

The app currently points to:

```text
https://script.google.com/macros/s/AKfycbzI2TMVFKOZotCW4Or2qSlCrvsML7Mn5EDyjyRB3oA4ktqqNzMxoWYpTlS-n1C9RXkHNg/exec
```

If you redeploy Apps Script and get a new URL, update `APPS_SCRIPT_URL` at the top of `app.js`.

## GitHub Pages

1. Create a GitHub repository.
2. Upload these three files to the repository root.
3. Go to `Settings > Pages`.
4. Set source to `Deploy from a branch`.
5. Select `main` and `/root`.
6. Save.

GitHub will give you a URL like:

```text
https://yourname.github.io/repository-name/
```

## Important Security Note

This GitHub Pages version uses JSONP because Apps Script web apps do not provide normal browser CORS headers for a static site. It works over HTTPS, but request payloads are placed in the URL. For a stronger production setup, use a small Vercel/Cloudflare backend proxy or move the backend to Supabase/Firebase.
