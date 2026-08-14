# Contributing

Changes should preserve Tallystead's local-first model and the boundary that the server—not the client—is authoritative for financial records, permissions, calculations, and automation.

Before opening a pull request:

1. Use fictional data in screenshots, fixtures, and bug reports.
2. Run `npm ci` and `npm run check`.
3. Test the change against a compatible Tallystead server.
4. Document any new or changed API dependency.
5. Include accessible labels, keyboard behavior, focus states, responsive behavior, and reduced-motion behavior in UI work.

Changes that require both server and web updates should identify the compatible server change and use a release order that never leaves a supported installation with an incompatible client.

