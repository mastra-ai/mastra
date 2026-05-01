# Release Smoke Index

This file is intentionally short. Use the smallest reference needed for the branch you are on.

## Alpha release

Start in the top-level `SKILL.md` under **Release smoke workflows**. It includes the commands to identify whether the alpha versioning PR is open, merged, or missing.

- If the alpha versioning PR is **open**, read `references/alpha-versioning-pr.md`.
- If the alpha versioning PR is **merged**, read `references/alpha-publish.md`.
- After alpha packages publish, read `references/release-scope-discovery.md`.

## Stable release

- For normal stable publish monitoring and final smoke, read `references/stable-release-smoke.md`.
- If stable publish partially fails, read `references/stable-partial-publish-recovery.md`.

## Targeted checks

- For changed features not covered by the generated project, read `references/targeted-feature-smoke.md`.
- For storage/provider schema or migration changes, read `references/storage-provider-migration-smoke.md`.
