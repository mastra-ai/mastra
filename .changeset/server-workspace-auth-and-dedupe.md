---
'@mastra/server': minor
'@mastra/core': patch
---

Workspace and skills HTTP routes now require an authenticated caller. Anonymous requests to workspace filesystem reads/writes, workspace skill management, and skills.sh registry proxy endpoints will be rejected by the server adapter when an auth strategy is configured.

Inline skills.sh proxy logic (URL constants, name and path validators, fetch helpers) has been removed from the workspace handler and replaced with calls into the shared `skills-sh-shared` module that already ships from `@mastra/server`. Behaviour is unchanged; the handler is just thinner and easier to test.

Adds unit coverage for `handleError` (verifying `ModelNotAllowedError` is surfaced as a 422 with the structured allowlist body) and for `validateMetadataAvatarUrl` (covering data-URL parsing, MIME allowlist, and size limits).

The `@mastra/core` bump is a patch because `permissions.generated.ts` is regenerated from `SERVER_ROUTES`; no consumer-visible permission shape changes.
