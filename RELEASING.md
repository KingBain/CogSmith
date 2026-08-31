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
5. The same workflow deploys the tagged release commit to GitHub Pages.

The first release is `v0.1.0`. No tag needs to be created manually. Commits merged into `main` are not deployed until they are included in a published release.

The Pages deployment is called directly when Release Please reports `release_created`. This works with the default `GITHUB_TOKEN`; a `RELEASE_PLEASE_TOKEN` is only needed if other release-created events must start separate workflows.

## Version and build identifiers

The semantic version identifies the product release. GitHub Pages stamps the released commit SHA into `version.js` as a separate build identifier. The service worker cache name combines both values, so each released deployment receives its own cache.
