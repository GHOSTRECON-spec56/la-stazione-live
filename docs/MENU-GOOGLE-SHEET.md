# La Stazione menu sheet

Sheet: https://docs.google.com/spreadsheets/d/1s7M9Lj8qjO_U80P7cEXT7oA_8YfUAi3nYKPOKFIPUB4/edit

Refresh script: https://script.google.com/d/1y5GXpUG-eJgI3KIsUq9GmIa9iuFcbzOK6bkC-frvQKTFj5-T2loQrU26/edit

The Google account used during setup owns both files. They are private by default; sharing the website owner page does not automatically grant access to this separate Google document. Use the sheet's Share button for staff who need it.

Setup completed under `lastazione10@gmail.com` on 14 September 2026. Every exported table cell was compared with the current published feed: 102 items, 167 price options, 13 extras and 16 subcategories. All matched. The overview formulas returned the same counts, and all nine tabs passed a visual review of Google's PDF export. The owner page includes a direct link to the sheet.

The sheet mirrors the published website menu from `https://lastazionelb.com/api/menu-export`. Its nine tabs are Start here, All items, All prices, Coffee, Tea, Food, Beverages, Extras and Categories. Category tabs retain a row per price option, while All items retains exactly one row per menu item. Descriptions, options, availability, featured status, both currencies, and extras assignments are included. Stable integration IDs remain in hidden columns.

## Updates

The owner page remains the source of published content. `setupMenuSheet` fills the sheet and installs a single Google-hosted trigger for `refreshMenuSheet` every 15 minutes. It must be run and authorized once by the owning Google account. Subsequent updates run even when the sheet and local computer are closed. Google may delay scheduled execution; the Start here tab records the last successful refresh. Edits made directly in the sheet are overwritten by the next refresh and never publish to the website.

`tools/menu-sheet/Code.gs` is the canonical script source. The setup tool replaces its spreadsheet ID placeholder before uploading it. The script stores stable tab IDs in its own properties, preserves the document URL between updates, and clears old rows after menu items are removed. Concurrent refreshes are prevented with a script lock. Invalid or unavailable source data is rejected before sheet mutation; unexpected Google errors during writing may leave some tabs updated before others and are reported in Apps Script Executions. A later successful refresh repairs those tabs.

To refresh manually, open the script and run `refreshMenuSheet`. To repair a missing timer, run `setupMenuSheet`; it does not create duplicate timers. To stop automatic updates, remove the `refreshMenuSheet` trigger from Apps Script's Triggers panel. The website continues operating independently of the sheet.

## Local tooling

`tools/google-sheets-auth.mjs --login` opens a local OAuth flow using Google's official clasp public desktop client with only `drive.file` and email scopes. Set `LA_STAZIONE_CLASP_CLIENT_MODULE` to the installed official clasp `auth/oauth_client.js` module. Credentials and setup state are stored outside this repository under the user's `.la-stazione-google` directory. They are not sent to Cloudflare.

For remote script edits, use `--manage-scripts` during login to request `script.projects` as well. The account must enable Google Apps Script API at `https://script.google.com/home/usersettings`; check the full signed-in email because Google's multi-account routing can open a different account. `--no-open` leaves browser navigation to the user. Remote edits use the Apps Script API; the legacy Drive update endpoint does not accept the newer script-project scope.

`node tools/setup-menu-sheet.mjs` resumes from that local state and avoids duplicate documents. It creates the native Google Sheet and imports the Apps Script source through the Drive API, which is enabled for the CLI client. The Sheets API is disabled for that client, so formatting and refreshes use Google-hosted Apps Script instead. The script requires its own first-run authorization to access the spreadsheet, fetch the public feed and install its timer.

Verification: `node --test tests/menu-sheet.test.mjs` checks complete field preservation, removal of obsolete rows, formula-injection handling, timer deduplication and preservation of existing data when fetching fails. After setup, verify the live Google document and its refresh timestamp as well.
