# Knowledge support agent

Describe a connectivity issue in Mastra Studio to investigate authorized customer cases and vendor guidance, with visible evidence references and diagnostic questions. Each turn prepares relevant customer history and receives the current safety policy through native Knowledge pins. Technician-confirmed outcomes stay in that conversation until reviewed publication is added.

## Why we built this

Support conversations need a clear boundary between shared documentation, one customer's records, and the support user's private conversation history. This template keeps those sources separate while preparing relevant evidence before the support model runs.

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
3. **Load the example Knowledge**
   - Preview the synthetic dataset with `npm run knowledge:seed -- --dataset retail-pos --dry-run`. This validates every file without opening the database.
   - Run `npm run knowledge:seed -- --dataset retail-pos` to load it. Repeating the command preserves unchanged page versions and note IDs.
4. **Start Studio**
   - Run:
     ```sh
     npm run dev
     ```
   - Open the private credential file at the path printed by the launcher locally and copy the token for `north-store`. Tokens expire after eight hours. Each dev launch generates a separate credential file and removes that file when it exits. A failed duplicate launch leaves the running server's credentials intact. The terminal prints the file path, never the tokens.
   - Open `http://127.0.0.1:4111` with the Studio `auth_header` query parameter set to `Bearer <copied token>`. Keep this local authorization URL private and out of recordings.
   - Select **Support**, open a new chat, and ask: “My Square Terminal loses network connectivity. What should I check?” Support can read the official-source summary and fictional customer case, cite its evidence, and ask about missing details. Its conversation is stored locally.

## Try it out

- Ask: “Can I factory reset while offline payments are pending?” The required safety policy prohibits that action because pending payments can be lost.
- Edit `knowledge-datasets/retail-pos/policy.md`, rerun the seed command, and ask again in the same chat. Native State Signals deliver the revised policy. Missing, empty, or truncated required policies block actionable guidance.
- Confirm a fictional outcome as the technician, then open another chat. The observation remains in the original conversation and does not publish Knowledge. Restart Studio to inspect the saved conversation.
- Open Studio with `north-other` or `north-colleague` and verify the first profile's conversations are absent. Seeded customer cases belong to store 1 and are readable by both `north-store` and `north-colleague`; conversations remain separate by actor and thread. `north-other` starts with empty customer history and the same authorized vendor guidance.
- Preview another use case with `npm run knowledge:seed -- --dataset software-integration --dry-run`. Its separately configured example profile and scopes do not change the retail Studio profiles.

## Customization

- Ask your coding agent to explore the template and propose a plan before changing it. For example: “Plan profile mappings for our support teams and identify which Knowledge scopes each team should read.”
- For another use case, define your example profiles and `exampleStudioRole` using [the retail POS example](src/examples/retail-pos/profiles.ts) as a starting point and import them in `scripts/dev.ts`. To try a different role locally, run `SUPPORT_STUDIO_ROLE=support-specialist npm run dev`. The launcher uses that role for generated credentials, and the server checks the same role when loading credentials. Tenant and customer Knowledge principals and Memory ownership come from the profile identifiers.
- Register dataset directories, permitted profiles, and required policy aliases in `src/examples/datasets.ts`. Each `knowledge-datasets/<dataset>/manifest.json` declares schema version `1`, stable page and note keys, relative Markdown files, source attribution, and links to page aliases. Required policy references are shared with `src/examples/support.ts`, which also configures customer record roots, topic matching, domain instructions, and an optional depth-one guide listing. Support delivers at most two native pins within a 500-token budget. Keep the policy short enough to arrive in full.

## Local development

Studio listens on loopback only. The ignored `.local/` directory contains the database and private profile credentials. Do not move the generated access file into source control.

Studio and the seed command share `SUPPORT_DATABASE_URL`, defaulting to `file:<current directory>/.local/support.db`. Only local file databases are supported. The seed command reads the current process environment. Export this optional override before running both commands. Seeded pages and notes are attributed to `seed:<dataset>`. Notes display an exact stable `Seed note: <dataset>/<page>/<note>` line. Keep these ownership markers intact. Removed manifest entries are retained and reported by stored ID.

Privileged writers share an exclusive lock beside the canonical database file. Contention exits with code `75`. Retry after the active writer exits. After a crash, rerun the same seed command with `--recover-lock` only once the owner has stopped. Recovery checks the recorded local host and PID and preserves the lock if ownership is uncertain or the process still exists. A `.writer.lock.recovery` file indicates interrupted recovery: stop all privileged writers, inspect its exact path, host, and PID, confirm that process has stopped, and remove only that recovery file in a quiescent operator window before retrying. Never remove an active or uncertain lock. Dangling symlinks and hard-link database aliases are rejected.

Rerunning converges after partial writes and keeps unrelated notes. Changed notes use native replacement and retain one current owned revision. Clearing a note date uses native add-then-prune because omitting a date in `updateNote` preserves the prior date.

Run `npm run typecheck`, `npm run test:unit`, `npm run test:integration`, and `npm run format:check` for deterministic verification. Integration tests use disposable databases, real HTTP and dev subprocesses, and a local scripted model provider. They do not require an OpenAI credential or send prompts to an external provider.

The Studio route boundary permits the Support chat, owned Memory reads and creation, read-only package capabilities, and scoped Knowledge browsing. Model, tool, instruction, scope, and authorization options supplied by clients are rejected. Support has viewer-only Knowledge access, including denial of pin mutations. Broader workflow and trace inspection remain unavailable.

## About Mastra templates

This template is being developed in the Mastra template repository. Its current first-run path uses this local directory.
