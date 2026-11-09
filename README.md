# Assure POS

## Windows desktop installer

The Windows installer is built at `release/Assure-POS-Setup-1.2.1.exe`. Run the installer, choose an install location, then open **Assure POS** from the desktop shortcut or Start menu. The app runs as a desktop window and starts its local service automatically; no Node.js installation or terminal command is needed on the shop computer. Close the window to stop the service.

On first launch, create the administrator account in **Set up your POS**. The installer does not include sample or shop records. The live database is created in `%APPDATA%\Assure POS\database\fnd-clothing-pos.sqlite`, separate from the installed program, so reinstalling or upgrading the program does not replace it. Back it up from **Settings → Backup** or close Assure POS and copy the database folder to another drive. Do not copy only the `.sqlite` file while the app is open; SQLite may also have `-wal` and `-shm` files in use.

The installer creates desktop and Start menu shortcuts. It is an unsigned local installer, so Windows may show its usual publisher warning. This build is for 64-bit Windows. It uses Electron 45 (Node.js 24 runtime) with the app's built-in SQLite database and does not need internet access after installation.

### Build a new installer

On a development computer with Node.js 24 and internet access, open PowerShell in this folder, run `npm install`, then run `npm run build:desktop`. The installer is written to `release/`. Do not include `database/*.sqlite` in any installer or ZIP intended for distribution.

### Barcode scanner check

Most USB barcode scanners work as keyboard input and need no driver or camera permission. Connect the scanner, open Assure POS, focus the barcode field on the register or product screen, then scan a product barcode. Confirm the digits appear and the matching item is found. Many scanners add Enter after the digits, which submits the scan automatically. If the barcode is typed into a plain text editor instead, check the scanner's USB keyboard mode and country/keyboard layout. Camera-based scanning is not included in this desktop build.

The Windows desktop app stores its live POS database in `%APPDATA%\Assure POS\database\fnd-clothing-pos.sqlite`. When running this source project with Node.js, the default database remains in this package folder:

`database/fnd-clothing-pos.sqlite`

The database includes normalized tables for products, variants, users, sales, sale lines, payments, returns, register shifts, expenses, stock adjustments, and settings. A versioned JSON snapshot preserves the application's complete current state and is mirrored into those tables in one SQLite transaction after edits.

## Run locally on Windows

1. Install Node.js 24 LTS or newer.
2. Open PowerShell in this project folder.
3. Run `npm install` once to install the frontend packages.
4. Run `npm run dev` to start the local app and SQLite API.
5. Open `http://127.0.0.1:3000`.

On a new, empty database, the app displays **Set up your POS**. Step 1 creates the first admin's name, username, and 4-digit PIN. Step 2 requires the business name, address, state, and GST registration type before checkout opens. No shop address, phone, or GSTIN is pre-filled. The PIN is stored as a salted hash. Existing databases with staff accounts continue to show normal sign-in and are not reset.

The dev server listens on this computer only. It does not expose the unauthenticated local database API to the shop Wi-Fi.

For a compiled local server, run `npm run build`, then `npm run start`. The SQLite database path can be changed by setting `POS_DB_PATH` to an absolute path before starting.

## Local database behavior

SQLite is the source of truth. A fresh setup starts with no products or transactions; add the shop's real inventory after signing in. Existing database contents are retained when upgrading the app. This build supports one local POS window at a time; concurrent sales from multiple terminals are not enabled.

Edits are saved to SQLite shortly after each change. If another app window changes the database at the same time, the app detects the revision conflict and asks for a refresh rather than overwriting newer data.

## Local verification

Run `npm run verify:local` to launch an isolated temporary POS database and verify first-run setup, sign-in/out, permission checks, barcode lookup, checkout stock movement, returns, GST totals, shifts, expenses, and persistence with 500 products and 500 sales. The script deletes its temporary database when it finishes and does not use the shop's database.

## Payment references

Card/POS and UPI/QR payments require a reference number before checkout can finish. Split tender supports cash plus card/POS or cash plus UPI/QR; when the electronic portion is greater than zero, its reference is required. The reference is saved with the transaction and printed on the receipt.

## Business registration and GST modes

At first run, choose one of three business modes. **Not registered** produces a retail receipt and never adds GST. **Regular GST** requires a GSTIN matching the selected business state and enables product GST calculations, tax invoices, and regular GST summaries. **Composition scheme** requires its GSTIN, does not charge or show customer GST, prints a bill of supply with the composition notice, and blocks interstate garment sales. The app checks GSTIN format only; it does not verify registration status or composition-scheme eligibility. Composition levy calculations and GST filing are not included. Review registration obligations, current rules, HSN classifications, rates, and invoice formatting with the shop's tax adviser before live use.

## GST handling and limitations

- Apparel HSN Chapters 61 and 62 use the current ₹2,500 per-piece threshold: 5% up to and including ₹2,500; 18% above. The rate is selected from the discounted per-piece taxable value at checkout. Confirm product classification and rates with the shop's tax adviser.
- Intra-state invoices split GST equally into CGST and SGST; selecting a different place-of-supply state records IGST. Customer GSTIN, address and state code can be added at checkout. The app validates GSTIN format only; it does not check the GST portal.
- Printed invoices include seller and buyer fields available in the app, invoice number/date, HSN, quantity, taxable values, tax rate, tax split, place of supply and an authorised-signatory line. Review the exact invoice format and HSN-digit requirements for the shop's turnover with its accountant.
- The HSN CSV is a review summary, not a GST portal return. The app does not file returns, generate IRNs/e-invoices, issue statutory credit notes, or establish that the shop is an active regular taxpayer. E-invoicing applicability depends on aggregate turnover and business circumstances.
- Non-apparel rates are configured per product and must be confirmed. Historical sample records retain the tax amounts stored when they were created.

Reference material: [CBIC tax invoice rules (Rule 46)](https://cbic-gst.gov.in/gst-invoice-rules.html), [GST Council September 2025 rate recommendations](https://gstcouncil.gov.in/sites/default/files/2025-09/press_release_press_information_bureau.pdf), and [official e-invoice mandate overview](https://einvoice6.gst.gov.in/content/einvoice-mandate/).

## Backups

Use the app's Settings → Backup screen to export a JSON backup. Also stop the app and copy `database/fnd-clothing-pos.sqlite` to a separate drive for a full SQLite copy. While the app is open, SQLite may also use the neighboring `-wal` and `-shm` files; do not copy only the main database file while it is running.

For a full app backup, copy the project folder including `database`, source files, `package.json`, and the lockfile, or use a timestamped ZIP in `backups/`. Each ZIP is a point-in-time snapshot and does not include later code changes. Keep backups on a separate, access-restricted drive and verify restores before depending on them.

## Staff account changes

An admin can open **Staff** and choose **Edit / Reset PIN** for a staff member. Update the name, username, role, account status, and individual permissions there. To reset a PIN, enter a new 4-digit PIN in both PIN boxes; leave both blank to keep the existing PIN. Usernames and PINs must be unique, the signed-in account cannot deactivate itself, and the app prevents disabling the last active admin. These edits do not remove sales or product records. PINs are salted and hashed in SQLite; the server stores only hashed, expiring session tokens and protects each state update by permission.

### Roles and permissions

- **Admin:** all permissions, including staff, settings, accounting, and reports.
- **Inventory manager:** register, sales history, returns, shifts, and product/stock management by default.
- **Cashier:** register, sales history, returns, shifts, and product viewing by default.
- Admins can set individual rights in the Staff edit panel. The server checks permissions in addition to hiding unavailable controls in the interface. Five failed PIN attempts trigger a 15-minute sign-in lockout for that address and username.

Use the admin account already configured for this shop. Existing usernames and PINs are retained when the server migrates them to salted hashes; change the admin PIN in **Staff** if it is still shared or easy to guess.

## Current limits

- The local database is for one computer and one active POS window. Concurrent multi-register editing is not enabled.
- Authentication and authorization are intended for a single locally hosted POS instance. Use the shop computer's operating-system account controls and keep the service bound to localhost; this is not hardened for public or untrusted networks.
- GST rates, HSN classification, invoice rules, and shop registration details must be reviewed before live tax reporting.
- The database API uses Node's built-in SQLite support; use a recent Node release (24 recommended for this package).
