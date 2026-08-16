# Tallystead Web

Tallystead Web is the browser client for the local-first, self-hosted Tallystead household finance server. It connects to a server URL supplied by the household, following the same client/server model used by self-hosted home applications.

See [CHANGELOG.md](CHANGELOG.md) for versioned browser-client changes and server compatibility notes.

The server remains authoritative for authentication, permissions, financial calculations, records, documents, automation, and local AI. This repository contains presentation and client interaction code only.

## Requirements

- Node.js 22
- npm
- A running Tallystead server for complete interactive testing

## Local development

Install dependencies and start the development server:

```sh
npm ci
npm run dev
```

Open `http://localhost:3000`. Enter the URL of the Tallystead server when prompted. The server must allow the web client's origin when they are served from different origins during development.

For the normal self-hosted deployment, Caddy serves this client and the API from the same origin. A separate source repository does not imply a separate runtime host.

## Quality checks

```sh
npm run check
```

The check runs TypeScript validation, source accessibility guardrails, brand-reference validation, and a production build.

## Container

Build the production web image:

```sh
docker build --tag tallystead-web:local .
```

The Tallystead server deployment should pin an exact published web image version or digest. Do not depend on a floating `latest` tag.

## API compatibility

The client currently calls Tallystead `/v1` endpoints and keeps its request/response types locally. Changes to an endpoint used by this client should be coordinated with the server repository and verified using an integration smoke test before release.

See [Architecture and release contract](docs/ARCHITECTURE.md) for the repository boundary and recommended release relationship.

## Security

Read [SECURITY.md](SECURITY.md) before reporting a vulnerability. Never attach real financial data, session tokens, credentials, household exports, receipts, or documents to a public issue.

## License

Tallystead Web is licensed under the [GNU Affero General Public License v3.0 only](LICENSE) (`AGPL-3.0-only`).
