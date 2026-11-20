# Knowledge support agent

Open a local support chat in Mastra Studio with profile-scoped Knowledge and persistent conversation history. This initial platform connects native Knowledge and Memory to one local LibSQL database. It provides a minimal smoke agent; dataset loading, troubleshooting behavior, and reviewed publication follow separately.

## Why we built this

Support conversations need a clear boundary between shared documentation, one customer's records, and the support user's private conversation history. This template establishes that boundary before adding support behavior.

## Prerequisites

- **[OpenAI API key](https://platform.openai.com/api-keys)**: set `OPENAI_API_KEY` for the default `openai/gpt-4o-mini` model.
- Work from this local template directory. This template is not yet published through the template installer.

## Quickstart 🚀

1. **Install dependencies**
   - From `templates/template-knowledge-support-agent`, run:
     ```sh
     npm ci
     ```
2. **Add your API key**
   - Copy the example configuration, then fill in the credential from Prerequisites:
     ```sh
     cp .env.example .env
     ```
3. **Start Studio**
   - Run:
     ```sh
     npm run dev
     ```
   - Open the private credential file at the path printed by the launcher locally and copy the token for `north-store`. Tokens expire after eight hours. Each dev launch generates a separate credential file and removes that file when it exits. A failed duplicate launch leaves the running server's credentials intact. The terminal prints the file path, never the tokens.
   - Open `http://127.0.0.1:4111` with the Studio `auth_header` query parameter set to `Bearer <copied token>`. Keep this local authorization URL private and out of recordings.
   - Select **Support**, open a new chat, and ask: “What Knowledge is available to this profile?” With a fresh database, the agent has no seeded customer guidance. Its conversation is stored locally.

## Try it out

- Open a second chat and verify its conversation history is separate from the first chat.
- Restart the dev server, use the newly generated token, and reopen the first chat to inspect its saved conversation.
- Open Studio with the `north-other` or `north-colleague` profile and verify the first profile's conversations are absent.

## Customization

- Ask your coding agent to explore the template and propose a plan before changing it. For example: “Plan profile mappings for our support teams and identify which Knowledge scopes each team should read.”
- For another use case, define your example profiles and `exampleStudioRole` using [the retail POS example](src/examples/retail-pos/profiles.ts) as a starting point and import them in `scripts/dev.ts`. To try a different role locally, run `SUPPORT_STUDIO_ROLE=support-specialist npm run dev`. The launcher uses that role for generated credentials, and the server checks the same role when loading credentials. Tenant and customer Knowledge principals and Memory ownership come from the profile identifiers.

## Local development

Studio listens on loopback only. The ignored `.local/` directory contains the database and private profile credentials. Do not move the generated access file into source control.

Run `npm run typecheck`, `npm run test:unit`, `npm run test:integration`, and `npm run format:check` for deterministic verification. Integration tests use disposable databases, real HTTP and dev subprocesses, and a local scripted model provider. They do not require an OpenAI credential or send prompts to an external provider.

The Studio route boundary permits the Support chat, owned Memory reads and creation, read-only package capabilities, and scoped Knowledge browsing. Model, tool, instruction, scope, and authorization options supplied by clients are rejected. Knowledge writes and broader workflow or trace inspection are unavailable in this initial delivery.

## About Mastra templates

This template is being developed in the Mastra template repository. Its current first-run path uses this local directory.
