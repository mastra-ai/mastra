---
'mastra': minor
'create-mastra': minor
---

Rename "Observe" to "Observability" across the CLI to match the product name.

- CLI flags: `--observe` / `--no-observe` / `--observe-project` are now `--observability` / `--no-observability` / `--observability-project`.
- Interactive prompt copy: "Enable Mastra Observability? (will open auth flow)" with a simple Yes/No.
- `.env` header and platform token names use "Mastra Observability".

This work is part of the unreleased Mastra Observability flow, so there are no deprecation aliases for the old flag names.
