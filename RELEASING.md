# Releasing CogSmith

CogSmith uses Release Please to manage semantic versions, the changelog, Git tags, and GitHub Releases. The canonical application version lives in `version.js`; Release Please updates its annotated version field.

## Pull request titles

Use Conventional Commit prefixes in pull request titles so Release Please can determine the next version:

- `feat:` for a minor release
- `fix:` for a patch release
- `feat!:` or a `BREAKING CHANGE:` footer for a major release

Other prefixes such as `docs:`, `test:`, and `ci:` can describe changes that do not independently require a version bump.

## Release flow

1. Merge normal pull requests into `main`.
2. Release Please opens or updates a release pull request containing the next version and changelog.
3. Review and merge the release pull request.
4. Release Please creates the matching `vX.Y.Z` tag and GitHub Release.

The first release is `v0.1.0`. No tag needs to be created manually.

By default the workflow uses `GITHUB_TOKEN`. If release-created events need to trigger other workflows, add a `RELEASE_PLEASE_TOKEN` repository secret containing an appropriate GitHub token.

## Version and build identifiers

The semantic version identifies the product release. GitHub Pages stamps the deployed commit SHA into `version.js` as a separate build identifier. The service worker cache name combines both values, so a deployment changes the cache even when the release version has not changed.
