# Digital Solutions — Invoicing
**Version V-14**

A free, static invoicing web app for **Digital Solutions** (By Pass Road, Rahim Yar Khan). Runs entirely in the browser — no server, no database, no cost. Built with plain HTML, CSS and JavaScript so it can be hosted for free on GitHub Pages.

## Features
- **Trial Balance**: a one-page overview of every customer's debit, credit and closing balance (Dr/Cr) for a date range — the classic accounting cross-check report
- **Consistent report branding**: Ledger, Reports and Trial Balance all open with your logo, business name and address on the left, and the report name with boxed "Date From / Upto Date / Print Date" on the right — matching a professional printed report format
- **Backup & Restore**: download all your data (invoices, customers, services, vouchers, settings) as a single JSON file from Settings — save it to Google Drive, WhatsApp, email, or a USB drive — and restore it on any device or after clearing browser data
- **4 color themes** — Classic Navy, Ocean Blue, Emerald, and Midnight Dark, switchable instantly from Settings → Appearance
- **Startup splash screen** — opens with Bismillah, then the Digital Solutions logo and brand, before landing on the Dashboard
- **Dashboard opens by default** on startup, with a live clock showing the day, date and time
- Saving an invoice automatically clears the form and generates the next invoice number, ready for the next customer
- Real Digital Solutions logo and tagline shown on every invoice and in the sidebar — editable anytime from Settings
- **Dashboard**: today's sales, total invoices, this month's revenue, outstanding balance, recent invoices
- **Customers**: save customers once; pick them from a dropdown on any invoice to auto-fill their details; new customers used on an invoice are saved automatically; optional opening balance for customers who already owed money before you started using the app
- **Cash Receipt / Payment vouchers**: record money received from or paid to a customer outside of an invoice (e.g. an advance, or a cash payout) — each gets its own CRV/CPV number
- **Ledger**: a running account statement for any customer — combines their invoices, invoice payments and cash vouchers into one chronological Debit/Credit/Balance report (Dr/Cr), with opening and closing balance, printable
- **Services**: save your common services with a default rate; pick them from a dropdown to add a pre-filled line item, or just start typing a description for autocomplete
- **Payment status**: mark each invoice Paid, Unpaid, or Partial payment (with amount received and balance due tracked automatically)
- **Reports**: Today / this week / this month / custom date range, with totals for billed, received and outstanding — printable
- Auto-generated invoice number with a configurable prefix (e.g. `DS-2026-0001`)
- Add / edit / delete service line items, with rate × quantity = total
- Automatic subtotal, discount (percentage or flat), and grand total
- **Payment QR + Easypaisa details** on every invoice, so customers can pay you directly by scanning the bank QR or sending to your Easypaisa account
- Live invoice preview as you type
- **Invoice paper size**: choose A4, A5, or an 80mm thermal receipt format in Settings — print, PDF and WhatsApp share all use the selected size, so the layout is never squeezed or oddly wrapped
- Print invoice, download as PDF, or **share directly to WhatsApp** (uses the native share sheet on supported phones, falls back to a WhatsApp link)
- Invoices, customers and services all saved to the browser's local storage — no account or server needed
- Invoice history with search and status filter, reopen and delete
- **Settings**: edit company name/tagline/address/email/phone/WhatsApp, upload a logo, upload a payment QR, edit Easypaisa details, change the currency label, change the invoice prefix
- Fully responsive — designed mobile-first since most invoices will be created and shared from a phone; on phones every section is reachable from a floating bottom navigation bar
- Installable as an app (PWA) — the browser shows a real "Install" option (not just a bookmark shortcut), and the app works offline after first load
- **About & developer info**: a "Developed by" panel at the bottom of the app, and a full "About Application" screen in Settings (version, features, contact, copyright)

## Files
Everything lives in one flat folder — no subfolders, so uploading to GitHub is a simple drag-and-drop of every file:

```
index.html
style.css
script.js
manifest.json
service-worker.js
offline.html
README.md
```

The logo, payment QR code, and app icons are embedded directly inside `script.js` / `manifest.json` as data — there are no separate image files to upload, so nothing can go missing or show up broken.

## Run it locally
No build step needed. Just open `index.html` in a browser, or serve the folder:

```bash
npx serve .
```

## Deploy to GitHub Pages (free hosting)
1. Create a new GitHub repository (e.g. `digital-solutions-invoice`).
2. Upload **every file** listed above to the repository (drag and drop all 7 files at once — there are no folders to worry about).
3. In the repository, go to **Settings → Pages**.
4. Under **Source**, choose the `main` branch and `/ (root)` folder, then **Save**.
5. GitHub will publish the site at:
   `https://<your-username>.github.io/<repository-name>/`
6. Open that link on your phone — your browser will offer a real **Install** option (Settings → Install app also has a button and instructions).

## Notes on data
- Invoices, customers, services and settings are all stored in the browser's `localStorage`, on the device you use. They are **not** synced between devices or browsers.
- Clearing browser data / site data will erase everything, so use **Settings → Backup & Restore** to download a backup regularly and save it somewhere safe (Google Drive, WhatsApp, email).
- The invoice number counter, history, customers and services all live in the same browser storage — using a different browser or device starts fresh unless you restore a backup there.
- The WhatsApp share button uses the Web Share API where supported (attaches the PDF directly); otherwise it opens a WhatsApp chat with a text summary of the invoice.

## Customizing
- Go to **Settings** in the app to change the company name, tagline, address, email, phone, WhatsApp number, currency label, invoice number prefix, and logo.
- The same Settings page has a **Payment details** section for your Easypaisa account title/number and the bank QR code shown on invoices — upload a new QR image any time your account changes. Uploaded images are stored directly in the browser, no file upload to GitHub needed.
- Brand colors are defined as CSS variables at the top of `style.css` (`--navy`, `--orange`, etc.) if you want to change the look and feel.

## Version History
- **V-14** — Updated brand logo (premium metallic Digital Solutions badge) applied everywhere: sidebar, invoices, ledger, reports, trial balance, splash screen, favicon, and app icons
- **V-13** — Trial Balance report; consistent branded header (logo, business name/address, report name, boxed date range) across Ledger, Reports and Trial Balance
- **V-12** — Backup & Restore, 4 color themes, Bismillah splash screen, bottom navigation, About/developer info, dashboard-first startup with live clock, one-page print fix

*(To ship a future update: bump `APP_VERSION` in `script.js`, and `splashVersion` default in `index.html`.)*
