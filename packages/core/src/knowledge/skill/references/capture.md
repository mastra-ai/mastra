# Capture

Capture converts a session's useful facts into Knowledge at the resource boundary. It is not an authorization mechanism.

## Choose capture scopes

The host derives capture scopes from the authenticated resource, thread, and application context. Keep resource and thread scopes when clamping the operation; dropping them can hide valid shared content or leak organization-wide content.

Captured records write to an uncurated companion associated with the curated destination. A companion is an ordinary node with `role: "mirror"`; it has no privileged read or write path. Treat its content as provisional until curation integrates it.

## Resolve mentions inside the frontier

Resolve wikilinks only among uniquely visible targets in the session-clamped scopes. Captured text cannot add authority. If a referenced target is hidden or ambiguous, preserve privacy and leave it unresolved.

## Separate capture from promotion

Capture appends evidence. It doesn't promote facts into curated nodes, alter grants, or rewrite structure. Promotion is a curation action with its own authorization and compare-and-swap checks.

## Protect semantic indexing

Before vector upsert, hydrate the node or record through authorized Knowledge reads and sanitize hidden `scope_ids`, names, and text from metadata. Recheck visibility when applying an outbox entry; permissions may have changed since capture.

## Test the real boundary

Cover at least:

- two principals with overlapping and private resource scopes,
- hidden mention targets producing no edge or text leak,
- delete and restore draining semantic outbox work,
- restart continuity for captured records,
- revocation after capture but before semantic indexing.

Use the installed memory package's capture configuration and TypeScript types for exact processor wiring.
