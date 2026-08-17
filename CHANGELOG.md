# Changelog

All notable changes to the independently released Tallystead browser client are recorded here.

## [0.2.2] - Unreleased

### Changed

- The bundled client automatically uses the origin from which it was loaded for all API requests and no longer asks the household to enter or retain a separate server URL.
- A failed initial connection keeps the current address visible and offers a retry without redirecting users to a network-configuration workflow.

### Compatibility

- Intended for Tallystead server `0.2.2`, whose Caddy/API path is host-neutral while preserving trusted-proxy authentication boundaries.

## [0.2.1] - Unreleased

### Changed

- Server networking is now a read-only operational view of environment-owned URLs, proxy trust, forwarded authentication, certificate state, service health, and sanitized request diagnostics.
- Removed browser controls for staging, testing, applying, and rolling back Caddy configuration so web settings cannot make the server unreachable.

### Compatibility

- Requires the corresponding `0.2.1` server network-status contract.

## [0.2.0] - Unreleased

### Added

- Safe empty-account deletion controls coordinated with the server conflict and audit contract.
- Review-queue search, selection, and bulk-review interaction improvements.
- Principal-entry support when resolving imported loan or debt payments.
- Display support for debt balance anchors, as-of dates, category-rule names, and match labels.
- Existing-member Pangolin SSO discovery and sign-in, plus an explicit forwarded-identity control in trusted reverse-proxy settings.
- A server-backed transaction search, filtering, page-size, total-count, and pagination workspace that can navigate beyond the legacy 500-row list.
- An accessible transaction detail and editing modal with previous/next navigation through the current filtered page, keyboard arrows outside form fields, Escape close, focus containment, and mobile full-screen treatment.
- Server-backed standard and transfer review queues with search, filtering, page sizing, totals, pagination, and explicitly page-scoped compatible-row bulk selection.
- Searchable, paginated transaction pickers for bill payments, received income, transfer resolution, and reimbursements, including records older than the legacy 500-row window.

### Changed

- Debt-payment activity is labeled explicitly instead of appearing uncategorized.
- Transfer and debt resolution payloads now preserve principal amounts separately from full payment amounts.
- Client package version advanced to `0.2.0` for the coordinated server/client contract update.

### Compatibility

- Requires the corresponding `0.2.x` server endpoints and response fields for the new debt, account-deletion, import-review, and rule-management behavior.
- The server remains authoritative for permissions, calculations, persistence, and audit history.

## [0.1.0] - 2026-08-14

### Added

- Initial standalone Next.js household client with server connection, authentication, responsive navigation, accessible financial workspaces, and the complete `0.1.x` server experience.
