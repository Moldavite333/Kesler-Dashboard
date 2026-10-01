# Nick's Financial Command Center

A local-first, phone-first personal finance dashboard designed for GitHub Pages.

## V2 features
- Safe-to-spend calculation
- Weekly flexible budget
- Bills and protected cash cushion
- Debt avalanche / snowball payoff simulator
- Debt progress snapshots and trend chart
- Spending transaction ledger
- 6-month income vs spending chart
- Current-month category breakdown
- Top merchants
- Daily burn rate and projected monthly spending
- Savings-rate estimate from recorded income
- Optional monthly category budgets
- JSON backup/restore
- CSV transaction import/export + template
- Money XP / progress system
- Installable PWA

## Privacy model
The repository contains only app code. Personal financial data is stored in the browser's local storage on the device where the app is used.

Do **not** put bank credentials, access tokens, full card numbers, SSNs, or exported personal backups into the GitHub repository.

CSV/JSON exports contain personal financial information. Treat those files as private.

## GitHub Pages
Serve the repository root from the `main` branch with GitHub Pages.

## Updating
Replace the app files with newer versions. V2 automatically checks for V1 browser data (`nfc-v1`) and migrates it into the V2 state when opened on the same browser/origin.
