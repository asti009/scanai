# Travel Review QR Management Platform

## Build plan
- Replace the starter page with a working, responsive review-management workspace: overview, agency settings, Routard/Tripadvisor/custom destinations, QR codes, campaigns, scan analytics, and printable review cards.
- Add Cloud-backed administrator sign-in without extra profile fields, and persist agency-owned records with row-level access controls. Keep the business name and review destinations blank until the administrator supplies the real values.
- Generate QR codes only from verified, configured HTTPS destinations. Support tracked redirect codes and direct-destination QR codes, plus export/print actions; never claim that a scan is a submitted review.
- Implement public tracked redirects that resolve saved QR records, reject inactive/expired codes, and record privacy-conscious scan events. Keep platform setup manual; do not claim undocumented integrations or invent review URLs.
- Add focused validation for URL safety and QR lifecycle rules, then verify the actual preview, current build diagnostics, and relevant tests.

## Technical approach
This project already runs TanStack Start, so use its routes, server functions, and Lovable Cloud rather than replacing the framework with the brief's separate Express/Prisma stack. Store agencies, destinations, QR codes, campaigns, and scan events in Cloud tables with explicit grants and row-level security. Use a small public redirect endpoint that only resolves a stored QR code; keep all private management operations authenticated. No fabricated analytics or seed agency identity.
