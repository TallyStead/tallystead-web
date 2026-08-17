# Architecture and release contract

## Repository boundary

This repository owns the Tallystead Next.js client, its browser assets, frontend tests, accessibility checks, container image, dependency automation, and web-specific security checks.

The Tallystead server repository owns the API, workers, scheduler, PostgreSQL and object storage integration, Caddy, Docker Compose, backups, install bundles, and the authoritative API specification.

The web client must not independently implement authoritative financial calculations or bypass server authorization decisions.

## Runtime topology

Production and normal home-server installations should continue to expose one canonical HTTPS server URL:

```text
Browser or future native client
              |
              v
          Caddy HTTPS
          /          \
         v            v
   Tallystead Web   Tallystead API
```

Keeping the web client and API on one origin simplifies passkeys, sessions, networking, and local-first operation. Independent source repositories do not require independent public hosts.

The bundled client derives the API base from `window.location.origin`. A separately hosted development or standalone client may select and retain another Tallystead API URL. The server uses bearer authentication rather than ambient cross-origin cookies, so this fallback does not require a configured CORS origin list.

## Release relationship

The web repository publishes `tallystead-web` using immutable semantic-version tags and records the resulting image digest. The server repository owns the installable release bundle and pins an exact tested web image version or digest.

Initially, server and web releases should be coordinated. Independent compatibility ranges should only be introduced after the server exposes machine-readable API version and capability information and automated compatibility tests enforce the declared range.

## API changes

Until a generated client is introduced, request and response types are maintained in `lib/`. Any server endpoint change used by the client requires:

1. coordinated server and web changes;
2. an identified compatible release order;
3. web type-check and production-build validation; and
4. an integration smoke test against the intended server release.

A generated `packages/api-client` or equivalent may be added later from the server's OpenAPI document. It should be generated and drift-checked, not hand-edited.

## Local development with two repositories

Keep the repositories beside one another rather than using a Git submodule:

```text
projects/
├── tallystead/
└── tallystead-web/
```

The web client can run with `npm run dev`. The server repository may optionally provide a developer Compose override that builds from `../tallystead-web`, while supported releases consume an immutable published image.
