# Contributing

This official template is maintained in the Mastra monorepo. Standalone template repositories are synchronized from the monorepo.

Follow the repository's contribution instructions and submit template changes in its `templates/template-mongodb-bedrock-agent` directory. Use independently authored fixtures for tests. Keep test data, runtime databases, generated artifacts, credentials and experiment logs out of source control.

## What the template is for

It shows one thing: a documentation agent whose retrieval and memory both live in a single MongoDB Atlas cluster, with the model and the embedder both on Amazon Bedrock. Keep additions in service of that. A change that adds another provider, another storage layer, or another required API key needs a reason beyond completeness.

## Code principles

- Clear, idiomatic TypeScript with human-readable names and small files.
- Prefer the direct, happy-path version. Guard clauses, retries, fallbacks, and abstractions for hypothetical reuse hide the idea being taught.
- Comments explain why, not what.
- ESM is strict (`NodeNext`): relative imports need explicit `.js` extensions.
- Register agents, tools, and vector stores in `src/mastra/index.ts`.

## Before you open a pull request

1. `npm install`
2. `npm run build` — must typecheck cleanly.
3. `npm run ingest && npm run dev`, then try the first-run prompt from the README in Mastra Studio. A change that breaks the first Studio interaction breaks the template.
4. If you changed setup, environment variables, or the first-run experience, update `README.md` and `.env.example`. The template page on mastra.ai is generated from `README.md`.

## Automated tests

Run `npm test` for local HTTP error regressions. To also test first ingestion and corpus
reconciliation, start a disposable MongoDB Atlas Local container and set
`TEST_MONGODB_URI` to its connection string before running `npm test`. These integration
tests create and remove uniquely named test databases; use a disposable instance.
Documentation and Bedrock responses come from a local HTTP server, so no AWS credentials
or paid model calls are needed.

## The one patched dependency

`@ai-sdk/amazon-bedrock` is pinned to an exact version and patched, via `patches/` and
`patch-package`. Bedrock can stream a tool-use block before its `input` arrives, which the
provider's schema rejected; the patch makes that field optional. Upstream fixed it, but only
in provider majors that require `ai` v6+ — this template is on `ai` v5 — so the patch stays
until that migration happens.

Two things follow. The version must stay exact, because `patch-package` matches the patch file
to it by name and a bump silently stops applying it. And `patch-package` is a runtime
dependency rather than a dev one, so `npm ci --omit=dev` still runs the `postinstall`.

## Working with Mastra APIs

Mastra's APIs change between versions. Load the [Mastra docs](https://mastra.ai/llms.txt) or the [published skills](https://mastra.ai/.well-known/skills/index.json) before making changes rather than relying on remembered APIs, and match the version pinned in `package.json`.
