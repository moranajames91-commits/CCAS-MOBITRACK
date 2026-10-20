

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/c88a716d-ed95-49dc-8d0f-e0d42e26774f

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Dual-Drive File Protection Engine

`ccas_dual_drive_engine.ps1` provides the background file protection layer for the local Windows installation.

- The normal `CHOOSE_Inventory_System.bat` launcher starts the engine before opening the app.
- Startup runs a checksum-based recovery check against `D:\CCAS_SYSTEM_BACKUPS\`.
- New and changed source files are copied to the Drive D mirror immediately when detected and again every 15 seconds.
- The engine ignores `node_modules`, `dist`, `.git`, `.vite`, log files, and temporary files.
- Recovery is limited to files listed in the last trusted manifest; it does not blindly copy unknown files into the system folder.

Manual checks:

- `powershell -ExecutionPolicy Bypass -File .\ccas_dual_drive_engine.ps1 -Mode Check`
- `powershell -ExecutionPolicy Bypass -File .\ccas_dual_drive_engine.ps1 -Mode Sync`

The engine is a deterministic backup and recovery service using file hashes and manifests. It is not a generative AI process, which is intentional for predictable data recovery.

## XAMPP MySQL Setup

1. Start **Apache** and **MySQL** in the XAMPP Control Panel.
2. The database is `cims_db`, using the default XAMPP connection: user `root`, blank password.
3. Import `cims/database_xampp.sql` in phpMyAdmin for a fresh installation.
4. For an existing installation, run `cims/migrate_repair_locations.sql`, `cims/migrate_operating_expenses.sql`, and `cims/migrate_cogs.sql` in phpMyAdmin or execute:
   `C:\xampp\mysql\bin\mysql.exe -u root cims_db < cims\migrate_repair_locations.sql`
   `C:\xampp\mysql\bin\mysql.exe -u root cims_db < cims\migrate_operating_expenses.sql`
   `C:\xampp\mysql\bin\mysql.exe -u root cims_db < cims\migrate_cogs.sql`
5. Ensure the API is deployed at `C:\xampp\htdocs\cims\api.php`.
6. The frontend API URL should be `http://localhost/cims/api.php`.

The admin dashboard's **Operating Expenses** section records day-to-day business overhead (such as rent, utilities, payroll, transport, and supplies). Product setup also records **COGS / Unit Cost**. Each checkout stores a snapshot of the product's unit cost on its transaction line, so later cost edits do not rewrite historical sales. The printable sales report supports weekly (Monday–Sunday), monthly, and yearly date ranges and includes COGS, gross profit, operating expenses, and net income. Existing products and sales from before COGS was enabled have no historical unit-cost snapshot; set each existing product's cost by editing it, and older sale lines will be excluded from COGS and flagged in reports.

## Dual-Drive Transaction Backup

The PHP API saves a JSON snapshot and an Excel workbook of transaction headers and their line items after every successful database write, including checkout, inventory changes, user changes, transaction deletes, and repair-ticket updates. These files contain transaction data, not SQL statements.

- Backup directory: `D:\CCAS_SYSTEM_BACKUPS\`
- Current snapshots: `transaction_backup_latest.json` and `transaction_backup_latest.xlsx`
- Timestamped archives: `transaction_backup_YYYY_MM_DD_HHMMSS.json` and `transaction_backup_YYYY_MM_DD_HHMMSS.xlsx`
- The Excel workbook uses a readable Arial font with styled Transactions and Transaction Line Items sheets, spacious frozen/filterable headers, alternating row shading, and currency, percentage, quantity, and coordinate formats.
- Retention: timestamped transaction backups older than 30 days are removed automatically.
- The backup contains `transactions` and `transaction_items` records. It does not include database schema or other tables, so it cannot rebuild a missing or damaged database.

Requirements:

1. Keep XAMPP MySQL running and ensure `C:\xampp\php\php.exe` is available.
2. Run Apache/PHP with an account that can create and write to `D:\CCAS_SYSTEM_BACKUPS\`.
3. The frontend does not directly access the MySQL data or the D: drive.

## Cloudflare R2 Transaction Backups

The PHP API uploads the latest JSON and XLSX transaction snapshots and their timestamped archives to a private Cloudflare R2 bucket after each successful database write. In **Settings → Cloudflare R2 Transaction Backups**, use **Back up now to R2** to create and upload the files immediately; saving the folder setting alone only changes the destination. R2 credentials are read only by PHP and are never sent to the React client. PHP first checks the local file `C:\xampp\private\cims-r2.env`, then falls back to Windows environment variables for any values missing from that file.

### Create an R2 bucket and API token

1. Sign in at [dash.cloudflare.com](https://dash.cloudflare.com/) and select the account that will own the backups.
2. Open **Storage & databases → R2 Object Storage** and create a bucket. Keep it private; public access is not needed.
3. Open **Manage R2 API Tokens → Create API token**.
4. Grant **Object Read & Write** permissions and restrict the token to this bucket. Create the token.
5. Copy the **Access Key ID** and **Secret Access Key** immediately. Cloudflare displays the secret only once; do not share it or put it in frontend code.
6. Copy the **Account ID** shown in the R2 overview. The S3-compatible endpoint is built by the API as `<account-id>.r2.cloudflarestorage.com`; the signing region is `auto`.

### Store the credentials on the Windows/XAMPP server

Use the local file, or Windows system environment variables as a fallback. If both provide a value, the local file takes precedence.

For the local file, create `C:\xampp\private\cims-r2.env` (outside `htdocs`) and add:

```dotenv
CIMS_R2_ACCOUNT_ID=your Cloudflare Account ID
CIMS_R2_ACCESS_KEY_ID=your R2 Access Key ID
CIMS_R2_SECRET_ACCESS_KEY="your R2 Secret Access Key"
CIMS_R2_BUCKET=your private bucket name
CIMS_R2_FOLDER=backup
```

Restrict file access to the Windows account running Apache and administrators. Do not put this file in the project, `htdocs`, or source control. Alternatively, on the machine running Apache, open **System Properties → Advanced → Environment Variables** and under **System variables** (not User variables) add:

| Variable | Value |
| --- | --- |
| `CIMS_R2_ACCOUNT_ID` | Cloudflare Account ID |
| `CIMS_R2_ACCESS_KEY_ID` | R2 Access Key ID |
| `CIMS_R2_SECRET_ACCESS_KEY` | R2 Secret Access Key |
| `CIMS_R2_BUCKET` | R2 bucket name |

Save system variable changes and restart Apache in the XAMPP Control Panel so PHP receives them. The local `.env` file does not require an Apache restart.

3. Ensure the PHP cURL extension is enabled and Apache can make outbound HTTPS connections to `*.r2.cloudflarestorage.com`.
4. Copy the current `cims\api.php` and `cims\backup_helper.php` into `C:\xampp\htdocs\cims\`, replacing older server copies. If the frontend's API URL uses `api_xampp.php`, deploy that current file there too. Restart Apache after updating PHP files. An `Invalid endpoint action` response to **Back up now to R2** means the server is still running an API copy that predates the manual backup action. In **Settings → Cloudflare R2 Transaction Backups**, enter the desired R2 folder/prefix and select **Save folder**. The folder is persisted on the server at `D:\CCAS_SYSTEM_BACKUPS\.r2_backup_folder.json`; it takes precedence over `CIMS_R2_FOLDER` in the environment/file, with `cims/mysql` used as the default.
5. Test the endpoint directly in a browser using `http://localhost/cims/api.php?action=r2_status`; it should return JSON. Run `C:\xampp\php\php.exe C:\xampp\htdocs\cims\test_r2.php` to test a signed R2 upload from the PHP CLI and print Cloudflare's response. It uploads a small diagnostic object under `backup/diagnostics/` (or the configured folder) and leaves it in the bucket.
6. Use **Back up now to R2** for an immediate test upload; subsequent successful database writes also trigger uploads. The status panel reports the last attempt and last successful upload, including failed filenames; detailed R2 errors are written to the PHP error log.

`HTTP 404` on the status URL indicates an incorrect endpoint path or that the updated `api.php` is not deployed there; R2 credentials and PHP cURL do not cause that HTTP status. Browser `Failed to fetch` usually indicates the browser could not access the PHP endpoint (check the browser console for CORS, mixed-content, network, or host/port errors). PHP cURL is needed for the R2 upload itself, not for the browser's status fetch. The R2 status/folder actions do not require MySQL after the API update; transaction backup operations still require MySQL.

The latest objects are stored as `<selected-folder>/transaction_backup_latest.json` and `<selected-folder>/transaction_backup_latest.xlsx`; dated JSON and XLSX archives use `<selected-folder>/archive/`. To limit cloud storage costs, optionally add an R2 lifecycle rule to expire objects with the `<selected-folder>/archive/` prefix after your chosen retention period. Keep both latest snapshot files excluded from that expiration rule. The configured folder and upload status are shown in the admin Settings panel. R2 status metadata is kept at `D:\CCAS_SYSTEM_BACKUPS\.r2_backup_status.json`; no API secret is written there.
