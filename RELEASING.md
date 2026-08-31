# Releasing CogSmith

CogSmith uses semantic versions and keeps one human-managed version in
`version.js`. Deployment builds add the current commit SHA automatically; do
not manually change the build value.

## Publish a release

1. Update `COGSMITH_VERSION.version` in `version.js` through a pull request.
2. Merge the version change after validation passes.
3. Tag the merged commit with the matching version and push the tag:

   ```bash
   git tag -a v0.1.0 -m "CogSmith v0.1.0"
   git push origin v0.1.0
   ```

The `Publish release` workflow checks that the tag matches `version.js` and
creates a GitHub Release with generated release notes. The site footer and PDF
reports use the same version. GitHub Pages stamps the short commit SHA into the
PWA cache name so every deployment refreshes installed copies.
