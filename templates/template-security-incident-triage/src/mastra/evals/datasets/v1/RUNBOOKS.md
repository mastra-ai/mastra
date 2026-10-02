# Approved v1 runbook snapshots

These files preserve the exact runbook bytes and versions referenced by the
approved v1 manifest. The offline replay and its authority records use these
snapshots through the same parser, chunker, and storage checks as the application.
The manifest, approval, input cases, and expected labels remain unchanged.

Changes to application runbooks do not amend this historical approval. The
`npm run eval:check -- --output NEW_DIRECTORY` gate exercises the current
application runbooks through the actual workflow. Historical offline scores do
not establish the behavior of the current policy.
