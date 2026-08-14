# Copy-out checklist

The staged folder is intentionally not a nested Git repository. After copying it to its permanent location:

1. Review the repository owner and security-reporting contact language in `SECURITY.md`.
2. Initialize Git and create the reviewed initial commit.
3. Create the GitHub repository as `tallystead-web` and push `main`.
4. Enable branch protection, required `Quality` and `Security` checks, secret scanning, push protection, private-vulnerability reporting, and Dependabot alerts.
5. Confirm GitHub Actions may publish `ghcr.io/<owner>/tallystead-web`.
6. Run the first pull request to verify quality, dependency audit, repository scan, container scan, and SBOM retention.
7. Coordinate the first `vX.Y.Z` tag with the package version. The release workflow refuses a mismatched tag or an existing container version.
8. Record the immutable image digest from the draft web release in the matching Tallystead server release.
9. Update the server's development and release Compose files to consume the published web image.
10. Run an end-to-end smoke test through the server's Caddy URL before removing `apps/web` from the server repository.

Do not delete the original `apps/web` until the copied repository, container release, server image pin, and complete smoke test all pass.

