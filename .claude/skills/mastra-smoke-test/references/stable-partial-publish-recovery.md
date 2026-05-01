# Stable Partial Publish Recovery

Use this only when the stable publish fails after some packages have already published.

Treat it as a partial release. Do not create a new versioning PR or bump versions. First identify the failed step and whether npm `latest` is split across old and new versions.

## Recovery flow

1. Record which packages already reached npm `latest` and which are still old.
2. Rerun the same stable `Publish to npm` workflow from the same release commit on `main`.
3. After the rerun succeeds, verify all intended package versions are on npm `latest`.
4. Verify release git tags were created after the successful publish.
5. Only then run final stable smoke against `create-mastra@latest`.

## Tag behavior

The `Add tags` step runs after publish:

```bash
pnpm changeset-cli tag
git push origin --tags
```

It creates and pushes git tags only for packages Changesets considers part of the current release/version bump, not every package in the monorepo. The tags look like `@mastra/core@1.29.0`, `mastra@1.7.0`, and `create-mastra@1.7.0`. If the first publish attempt fails before `Add tags`, the rerun should create tags for the full changed-package release set after npm publish completes.

Verify changed-package tags, not every workspace package:

```bash
git fetch --tags
# Spot-check release-critical tags
git tag -l '@mastra/core@<version>'
git tag -l 'mastra@<version>'
git tag -l 'create-mastra@<version>'
git tag -l '@mastra/server@<version>'
git tag -l '@mastra/playground-ui@<version>'
```

If a package version is on npm `latest` but its expected release tag is missing after a successful rerun, stop and report it before smoke testing.
