# Nick's Financial Command Center

A local-first, phone-friendly personal budget and debt-payoff PWA designed for GitHub Pages.

## Security model

This repo contains code only. Personal finance data is stored in the browser's localStorage on the device using the app.

**Never commit:**
- bank usernames or passwords
- Plaid access tokens
- full account/card numbers
- SSNs or tax IDs
- exported personal backup JSON files

## Features
- Safe-to-spend calculation
- Weekly flexible budget
- Bills and due dates
- Debt avalanche / snowball prioritization
- Payoff estimate using balances, APRs, minimums, and extra payment
- Debt progress tracking
- Money XP / simple gamification
- JSON backup and restore
- Installable PWA

## Publish with GitHub Pages
1. Create a new repository.
2. Upload the files in this folder to the repository root.
3. In GitHub: Settings → Pages.
4. Set Source to `Deploy from a branch`.
5. Choose the `main` branch and `/ (root)`.
6. Save, then open the Pages URL on your phone and use **Add to Home screen** / **Install app**.

## Notes
The payoff calculator is an estimate. It assumes balances and APRs stay fixed except for payments and monthly interest, and it does not model new purchases, fees, promotional APR expiration, or payment timing.
