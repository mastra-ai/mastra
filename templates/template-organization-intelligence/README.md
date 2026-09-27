# Organization Intelligence

Organization Intelligence answers company questions using documents from local folders, Google Drive, and S3-compatible storage. It indexes Markdown, text-bearing PDFs, DOCX, and native Google Docs and Sheets, then returns answers with citations and source freshness through Mastra Studio, HTTP, or MCP.

## Why we built this

Finding a policy or reconciling conflicting documents often means searching several systems. We built this template to reduce that work while keeping answers traceable, so users can check the supporting evidence and see when a source is out of date.

## Demo

<video controls width="640" height="360" src="https://res.cloudinary.com/mastra-assets/video/upload/v1790332288/organization_inteligence_template_wo7ycp.mp4"></video>

This demo runs in Mastra Studio, HTTP API or via MCP, but you can connect this workflow to your React, Next.js, or Vue app using the Mastra Client SDK or agentic UI libraries like AI SDK UI, CopilotKit, or Assistant UI.

## Prerequisites

- **[OpenAI API key](https://platform.openai.com/api-keys)**: set `OPENAI_API_KEY` in `.env`. This is the only credential needed for the default local setup. Normalized text and query embeddings use `text-embedding-3-small`; questions and retrieved excerpts go to `gpt-5.6-terra`. These operations incur provider usage.
- **[Google Drive credentials (optional)](https://mastra.ai/integrations/file-storage/google-drive#service-account)**: set `GOOGLE_DRIVE_CLIENT_EMAIL` and `GOOGLE_DRIVE_PRIVATE_KEY` in `.env` using `client_email` and `private_key` from the service account JSON key. Quote the private key and preserve its escaped `\n` line breaks. Share the source folder with the service account as a Viewer. Enable the Google Drive API and, for native document tabs, the Google Docs API in the service account's project.
- **[S3 / Cloudflare R2 credentials (optional)](https://mastra.ai/integrations/file-storage/amazon-s3)**: set `S3_ACCESS_KEY_ID` and `S3_SECRET_ACCESS_KEY` in `.env` using the provider's access key ID and secret access key. Allow listing and reading the configured bucket or prefix. For R2, use Object Read credentials scoped to the bucket.

Remote credentials are needed only when the corresponding source is enabled. Keep folder IDs and storage settings in `source-catalog.json`, as described in [Optional remote sources](#optional-remote-sources).

## Quickstart 🚀

1. **Create the template**
   - Run `npx create-mastra@latest --template organization-intelligence` and choose `organization-intelligence` as the project directory when prompted.
   - Run `cd organization-intelligence`, then `npm ci` to install the locked dependencies.
2. **Add your API key**
   - Run `cp .env.example .env` and set `OPENAI_API_KEY` as described in Prerequisites.
   - Keep the supplied `source-catalog.json`. Only the local source is enabled; no Drive or R2 account is needed.
3. **Start the dev server**
   - Run `npm run dev`.
   - Open [Mastra Studio](http://localhost:4111), select **Organization Agent**, and ask “How long are invoices retained?” Expect seven years after the end of the fiscal year, a citation to `/sample/records-retention.md`, and source freshness.

## Try it out

- Ask an unrecorded policy question. The answer reports `insufficient_evidence` instead of inventing a policy.
- Add a Markdown, text-bearing PDF, or DOCX file to `sample-documents`. Leave the server running. The next five-minute refresh discovers it automatically; ask a question about a fact found only in that file after synchronization succeeds.
- Inspect `GET http://localhost:4111/organization-telemetry` before and after the refresh. Look for a new successful sync run and the source's indexed count. To refresh immediately, run **sync-organization-sources** in Studio with `{"trigger":"manual"}`.
- Enable Drive and R2, then ask a question that needs evidence from both. Citations preserve the remote source identity; private R2 files have mounted locators instead of invented public URLs.
- Add a native Google Doc with multiple tabs or a Google Sheet with multiple worksheets. Ask about a fact outside the first tab or worksheet and inspect its citation.

## Customization

- Ask your coding agent: “Explore the source catalog, Workspace setup, and answer contract. Propose how to add a read-only source while preserving citations and containment tests.”
- Edit `source-catalog.json` to choose sources. Catalog changes require a restart; new documents in an existing source do not.
- Start with `src/mastra/index.ts` to see the registered components. Agents, tools, workflows, and Workspace providers have their own folders under `src/mastra`.

## Optional remote sources

Both integrations are already installed. After configuring the credentials in [Prerequisites](#prerequisites), copy the relevant entries from `source-catalog.example.json` into `source-catalog.json`, fill in the source details, and set `enabled` to `true`:

- **Google Drive:** set `folderId` to the ID of the shared source folder.
- **S3 / R2:** set `bucket`, `endpoint`, `region`, and `prefix`. For R2, use the HTTPS account endpoint and `region: "auto"`.

Restart with `npm run dev` after changing the catalog. Local, Drive, and S3 sources can remain enabled together. Source access is read-only; OCR is not included.

The [filesystem mounts walkthrough](https://mastra.ai/blog/introducing-filesystem-mounts) explains how the providers share one Workspace.

## API and MCP

With the server running, send an HTTP question:

```sh
curl -sS http://localhost:4111/organization-answer \
  -H 'content-type: application/json' \
  -d '{"question":"How long are invoices retained?"}'
```

Connect an MCP client to `http://localhost:4111/api/mcp/organization-intelligence/mcp`. The server tool is `answerOrganizationQuestion`; a Mastra MCP client configured with the server name `organization` exposes it as `organization_answerOrganizationQuestion`. Pass `{"question":"How long are invoices retained?"}`. See the [Mastra MCP client documentation](https://mastra.ai/reference/tools/mcp-client).

Studio renders a readable answer and citations; HTTP and MCP preserve the structured answer contract. This is a local/trusted single-organization template. The default server binds to `127.0.0.1` and has no authentication provider. Before exposing it through a proxy, tunnel, or deployment, configure [Mastra authentication](https://mastra.ai/docs/auth/overview) and restrict access to trusted members of that organization. Both custom routes require authentication when a provider is configured; a route flag alone does not configure authentication.

## Operations

Studio conversations persist in the configured Mastra storage. Reopen the same chat to continue with its history; the agent includes the last 20 messages in its context. Follow-up questions use recent conversation history to form a standalone document search query. The original question stays in the chat. If the reference is ambiguous, the agent asks for clarification; if contextualization fails, it searches with the original question. This adds one model call for questions with conversation history. See [Mastra memory](https://mastra.ai/docs/memory/overview) for configuration options. The custom HTTP and MCP endpoints continue to handle independent questions. Clarification responses use `clarification_required` with no citations.

Synchronization runs once at startup, manually on demand, and every five minutes while the server is running. Failed remote scans retain the last committed evidence with a stale warning; only complete scans can remove missing indexed records. Keep a source ID bound to the same provider and root. Disabling a source and restarting excludes its cached evidence.

`GET http://localhost:4111/organization-telemetry` returns seven days of metadata-only sync counts, question outcomes, retrieval timing, source use, and reported tokens. Unavailable usage or monetary cost stays unavailable. It does not store question text, answer bodies, document excerpts, or credentials, and no external trace exporter is configured.

Application state, including chat history and the document index, lives in `.mastra/organization-intelligence.db`. For an intentional full reset, stop every instance and remove only that file, `.mastra/organization-intelligence.db-wal`, `.mastra/organization-intelligence.db-shm`, and `.mastra/source-identities.json`. This also deletes saved conversations. Restart with `npm run dev`. Preserve `.env`, `source-catalog.json`, and all source documents. Rebuilding requires a new scan and paid embeddings. Hosted persistence requires a separately verified adaptation.

## About Mastra templates

This is an official [Mastra template](https://mastra.ai/reference/templates/overview), a starting point you can run, explore, and adapt to your own projects. Official templates live in the [Mastra monorepo](https://github.com/mastra-ai/mastra/tree/main/templates/template-organization-intelligence) and are automatically synced to standalone repositories.

Want to contribute? See [CONTRIBUTING.md](https://github.com/mastra-ai/mastra/blob/main/templates/template-organization-intelligence/CONTRIBUTING.md) for setup, checks, and pull request guidance.
