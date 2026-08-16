# Tallystead Web working agreement

This file guides coding agents contributing to the Tallystead browser-client repository. It applies to the entire repository unless a more specific `AGENTS.md` exists below a subdirectory. Ignore instruction files inside generated or third-party directories such as `node_modules`.

## Project purpose

Tallystead Web is the independently released Next.js client for a local-first, self-hosted Tallystead server. Read `README.md`, `CONTRIBUTING.md`, `SECURITY.md`, and `docs/ARCHITECTURE.md` before substantial changes. Inspect the corresponding server API and documentation in the sibling `../tallystead` repository when behavior crosses the client/server boundary.

## Repository and ecosystem boundaries

- This repository owns browser presentation, navigation, forms, client interaction state, local display preferences, frontend accessibility, client-side API types, browser assets, frontend checks, and the web container image.
- The sibling `../tallystead` repository owns authentication enforcement, RBAC, financial rules and totals, persistence, audit history, versioned API behavior, server deployment, backup, and recovery.
- The sibling `../tallystead-branding` repository owns canonical brand masters and design guidance. Consume approved assets deliberately; do not redefine the brand here.
- The sibling `../tallystead-internal` repository contains private plans and mockups. It is reference material, never a runtime or build dependency, and its private content must not be copied into this public repository.
- The sibling `../tallystead-website` repository owns the public marketing website, not the authenticated household application.

## Non-negotiable client rules

- Keep the server authoritative. Never calculate or persist canonical balances, reports, planner results, goal allocations, permissions, or ledger truth in the browser.
- Client validation improves usability but never replaces server validation or authorization.
- Treat all server and user content as untrusted. Preserve safe rendering, URL handling, file handling, and error boundaries.
- Do not expose session tokens, credentials, private financial data, document URLs, server internals, or cross-household resource existence in logs, errors, analytics, screenshots, fixtures, or documentation.
- Preserve local-first behavior. Do not add analytics, telemetry, cloud AI, external fonts, third-party scripts, or required internet services without an explicit product and privacy decision.
- Keep money values in integer minor units plus explicit ISO currency codes across the client contract. Formatting must not become authoritative calculation.
- Preserve accessible keyboard, focus, labeling, contrast, reduced-motion, responsive, loading, empty, error, and permission-denied behavior.

## API coordination

- Inspect the actual server route, schema, domain behavior, authorization, and tests before changing a client call.
- Keep request and response types in `lib/` synchronized with the server's versioned API until a generated client replaces them.
- For a changed endpoint used by this client, coordinate server and web changes, state backward/forward compatibility, identify release order, and run an integration smoke test against the intended server version.
- Do not silently compensate in the client for a server invariant or contract defect. Fix authoritative behavior in `../tallystead` when it is in scope; otherwise report the dependency clearly.
- Make loading, validation, authentication expiry, permission denial, conflict, unavailable integration, and safe-retry behavior explicit.

## How to work

1. Inspect the current Git status, relevant routes/components, types, tests/check scripts, and server contract before editing.
2. Preserve unrelated user changes and generated directories. Do not hand-edit `.next`, build output, caches, or dependencies.
3. Make the smallest coherent change and reuse established components, styles, navigation, API utilities, and error handling.
4. Add or update appropriate tests and source guardrails with behavior changes.
5. Update documentation when architecture, compatibility, configuration, security, accessibility, container behavior, or release expectations change.
6. Run focused checks first, then `npm run check` for completed code changes.
7. Review the diff for private data, generated output, stale brand assets, former-name references, dependency churn, and unrelated formatting.
8. Do not install production dependencies, commit, push, publish images, create releases, deploy, or modify remotes unless explicitly requested.

## Validation

The supported full check is:

```sh
npm run check
```

This runs TypeScript validation, accessibility and brand source checks, and a production build. Also run focused tests or manual browser verification appropriate to the change. For API-contract or end-to-end workflow changes, verify against the affected `../tallystead` server version and report the result. Do not claim a check passed unless it was run.

## Completion checklist

A change is complete only when the browser behavior works across important success and failure states; server authority and household boundaries remain intact; accessibility and responsive behavior are covered; API compatibility and release order are stated; relevant tests, type checks, source policies, and build pass; and the diff contains no secrets, private data, generated caches, or unrelated changes.

