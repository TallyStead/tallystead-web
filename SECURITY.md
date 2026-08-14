# Security policy

Tallystead Web displays financial records, credentials, receipts, and household documents obtained from a household's Tallystead server. Treat suspected exposure as sensitive even when the affected installation is only reachable on a local network.

## Reporting a vulnerability

Do not open a public issue containing a real password, passkey response, session token, integration secret, household export, receipt, statement, database dump, backup, or log with private financial data. Contact the repository owner privately with the affected version, a minimal reproducible description, the expected and observed boundary, and sanitized evidence created with fictional data.

Revoke exposed credentials and sessions immediately. Preserve original evidence privately for follow-up.

## Supported code

Security fixes target the current `main` branch until the repository publishes a supported-version policy. The server repository owns the deployment, API, Caddy, authentication services, data storage, and backup boundary.

## Contribution expectations

- Never commit runtime `.env` files, credentials, tokens, private keys, household data, or real financial samples.
- Use fictional fixtures and screenshots.
- Keep pull-request workflows read-only and do not expose secrets to untrusted code.
- Treat authentication flows, passkeys, session storage, authorization-dependent navigation, document handling, API transport, and workflow changes as security-sensitive.
- Do not weaken a security check solely to make a build pass. Document and review any time-bounded exception.

