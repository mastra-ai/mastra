# Personal Assistant

A personal assistant for questions, planning, and writing that remembers your response preferences across conversations and restarts. Connect services through Mastra Connect to retrieve source information and review external changes before approving them in Studio.

## Why we built this

Building your own assistant lets you shape how it works around your preferences and the services you already use. Mastra Connect manages account authorization and supplies tools for those services, so you can add responsibilities without building each integration yourself. This template gives you a starting point with persistent memory, objectives, and schedules, while keeping external changes subject to your approval.

## Demo

<video controls width="640" height="360" src="https://res.cloudinary.com/mastra-assets/video/upload/v1794299422/Mastra_Personal_Assistant_gemevy.mp4"></video>

## Prerequisites

- **[OpenAI API key](https://platform.openai.com/api-keys)**: set `OPENAI_API_KEY` for the default `openai/gpt-6-luna` model. Your account needs access to that model; `AGENT_MODEL` selects the chat model. On Mastra Platform, select a `mastra/<provider>/<model>` gateway model; gateway models do not require `OPENAI_API_KEY`. `AGENT_MODEL` takes precedence over the legacy `ASSISTANT_MODEL` fallback.
- **[Mastra Connect credentials](https://mastra.ai/docs/mastra-platform/connect)**: required for connected services and the Gmail, Google Docs and Notion examples. Set `MASTRA_PROJECT_ID` and `MASTRA_PLATFORM_ACCESS_TOKEN` together after creating a Platform project and app access token. `MASTRA_PLATFORM_SECRET_KEY` is the native fallback. Connect accounts in that project separately; the OpenAI key does not authorize access to them.

## Quickstart 🚀

1. **Create your project**
   - Run `npx create-mastra@latest my-personal-assistant --template personal-assistant` to scaffold the template and install dependencies.
   - Run `cd my-personal-assistant`.
2. **Add your API keys**
   - Run `cp .env.example .env` and fill in the values described under Prerequisites.
3. **Start the dev server**
   - Run `npm run dev` and open [Mastra Studio](http://127.0.0.1:4111).
   - The CLI creates a private `.data/owner-token` file (or uses `ASSISTANT_API_TOKEN`). Select **Sign in**, enter any email and paste that token as the password. Select **Personal Assistant** and send “Help me plan a focused morning.” The assistant should suggest a practical plan in the conversation.

## Try it out

- Say “Remember that I prefer concise bullet points.” Restart the server, open a new conversation, and ask for a morning plan. Look for the saved response style.
- (depends on Mastra Platform) With Gmail and Google Docs connected, ask “Read Gmail message `<message ID>` in full, review the proposal, cite the message ID, and create a Google document with the review.” Review the separate document-creation and content-insertion approvals. A created blank document is unfinished; if insertion fails, keep the document ID and inspect it before deciding to retry.
- (depends on Mastra Platform) With Notion connected, ask “Read the tasks on page `<page ID>` as markdown and rank them by deadlines and blockers. Cite source IDs and identify missing dates or unread pages. Do not change Notion.” The reviewed markdown read runs without confirmation; other Notion reads require approval. A truncated page or unknown blocks leave the task inventory incomplete.
- Say “Set an objective to prepare my meeting agenda. Track research, drafting and review as tasks; wait for my meeting topic before proceeding.” Supply the topic when asked, then restart and inspect the unfinished objective and tasks in that conversation. Ask to pause, resume with an additional evaluation allowance, or clear one when needed.

## Customization

- Open the project in your coding agent and describe a change, such as “Adapt the assistant to help me prepare weekly learning plans. Explore the code and propose a plan before making changes.”
- Edit instructions and native agent behavior in `src/mastra/agents/personal-assistant.ts`, and the working-memory template in `src/mastra/runtime.ts`. The goal judge defaults to the selected chat model. Set `ASSISTANT_JUDGE_MODEL` to override it with an OpenAI or Mastra gateway model (a direct OpenAI model still requires `OPENAI_API_KEY`) and `ASSISTANT_MAX_GOAL_EVALUATIONS` (1–20, default 5) to bound each requested allowance. The judge uses at most three steps per evaluation. These execution limits are not a monetary cap. An exhausted objective pauses; resuming extends its budget without resetting prior usage. No objective starts on boot. Optional `.env` settings include `ASSISTANT_OWNER_ID` (default `local-owner`), `ASSISTANT_MAX_STEPS` (1–20, default 20), and `ASSISTANT_TIMEZONE` (an IANA timezone). Keep the owner ID stable to retain access to existing context.

Optional `ASSISTANT_MAX_OUTPUT_TOKENS` (1–32768, default 4096) caps output for every model attempt, including scheduled checks and the goal judge. `ASSISTANT_MODEL_MAX_RETRIES` (0–5) sets each native model/provider and processor retry limit; zero disables both, while positive limits can compound. For a bounded scheduled analysis that needs a read and a later answer step, set `ASSISTANT_MAX_STEPS=6`, `ASSISTANT_MAX_OUTPUT_TOKENS=1024`, and `ASSISTANT_MODEL_MAX_RETRIES=0`. The ordinary step default remains 20. When retry settings are unset, native retry defaults remain in effect; every dispatched retry consumes the shared model allowance. Connect's own HTTP read retries are separate. Request options can lower the configured output cap, and execution options must be supplied in the validated body rather than query parameters.

To enable connected tools, follow the linked Connect setup, add the Connect credentials to `.env`, and authorize the services you need. `ASSISTANT_CONNECT_PROVIDERS` accepts a JSON array of provider IDs and defaults to `["google-mail","google-docs","notion","jira"]`. `ASSISTANT_CONNECT_TOOLS` optionally restricts the available exact tool keys; it does not change provider OAuth permissions. Optional `MASTRA_ORG_ID` and `MASTRA_PLATFORM_REGION` follow the native Connect configuration.

The developer-owned read registry in `src/mastra/connect.ts` permits the exact keys `google_mail_get_message` and `notion_get_page_as_markdown` without confirmation for sources accessible to the connection. Every other connected tool, including unfamiliar reads, similar names and Notion mutations, requires native approval. Connections refresh before runs and recovery; unresolved providers are reported as unavailable rather than empty sources. One owner's scope includes project-global connections. Review project access before connecting sensitive accounts.

Approval decisions apply to the pending run and stored arguments. Return to the same conversation after restarting to recover pending calls. Retrieved content cannot grant permissions. Full plain-text email decoding is limited to 64 KiB, 64 MIME parts and eight nested levels; attachments and HTML-only content are unsupported. External mutations can fail partially or have uncertain results. Inspect existing provider references before deciding to retry; the template adds no automatic mutation retry.

## Local operation

Conversations, preferences, objectives, tasks, schedules, and native traces persist in `.data/assistant.db` without automatic expiration. `ASSISTANT_DATA_DIR` changes the directory, relative to the template root or an absolute path. Keep your database private; deleting it removes the installation's stored context. Hosted production uses remote Turso storage instead, as described below.

Both local and hosted APIs require owner authentication. Use `Authorization: Bearer <owner token>` for API clients. Studio uses native sign-in; cookie-based local mutations also require matching Origin and `Sec-Fetch-Site: same-origin`. Keep the token private. The local CLI reuses it across restarts; programmatic consumers should configure `ASSISTANT_API_TOKEN` explicitly.

The server accepts at most 1 MiB per request and defaults to 240 API requests per minute. Chat, goal judging, native retries and scheduled checks share a process budget of 120 model attempts per hour and two concurrent model attempts. Each attempt reserves serialized input bytes plus the configured output allowance against `ASSISTANT_MAX_MODEL_TOKENS_PER_HOUR` (default 10,000,000); inputs over 256 KiB are rejected. Reservations are conservative text-work allowances, not measured token usage or a monetary spending cap. They reset after one hour or process restart and are not shared across server replicas. Set provider-side spending controls for a monetary limit. Adjust these bounds through the matching variables in `.env.example`.

Keep at most ten active or paused schedules by default (`ASSISTANT_MAX_SCHEDULES`). Recurring schedules use minute granularity or a fixed seconds field; sub-minute cadence is rejected on creation, update, resume and dispatch. Cancelling a schedule frees capacity; an identified creation replay preserves the existing schedule even when capacity is full.

For a built local server, run `npm run build` and then `npm start`. Both use the same configured local database as development.

## Mastra Platform operation

Follow the [Mastra Platform deployment guide](https://mastra.ai/docs/mastra-platform/deploy) to deploy this assistant, and apply the configuration below. Validate remote persistence, Studio recovery, and connected examples on your target.

- Configure a remote **[Turso database](https://mastra.ai/docs/mastra-platform/system-environment-variables)** with `TURSO_DATABASE_URL` (`libsql://<database>.turso.io` or HTTPS, without URL credentials or query options) and `TURSO_AUTH_TOKEN`. Set `ASSISTANT_RUNTIME=hosted` and a private `ASSISTANT_API_TOKEN` of at least 32 characters. Keep `ASSISTANT_OWNER_ID` stable. Hosted mode listens on `0.0.0.0` and refuses missing remote storage or owner authentication.
- Set `MASTRA_PLATFORM_STUDIO_AUTH=disabled` as documented in [Platform Studio authentication](https://mastra.ai/docs/mastra-platform/studio). This preserves this assistant's native SimpleAuth instead of replacing it with organization-wide access. Authenticate API requests with `Authorization: Bearer <ASSISTANT_API_TOKEN>`. In Studio, select **Sign in**, enter your email, and use `ASSISTANT_API_TOKEN` in the password field. SimpleAuth identifies the owner by the token; the email field does not select an account. Confirm this flow on your deployed target before using personal data.
- Actual Platform runtime indicators require explicit hosted mode. `NODE_ENV=production` alone still permits a built local server. Project credentials used for local Connect do not turn on hosted mode.
- Local and hosted installations have separate state. The template never copies the local database to Turso. Retain or remove each database deliberately; there is no automatic data migration or retention policy. Run one active scheduler instance and validate runtime availability and restart behavior on the selected topology.

The template configures a native storage exporter for traces. They retain execution identities, native outcomes and provider references while omitting message bodies, full tool payloads and raw errors; inspect provider references and exact approval arguments in the original conversation. A dispatch trace is not confirmation of a provider effect. Optional `ASSISTANT_PLATFORM_TRACING=true` adds the application's native Platform exporter in hosted mode and requires `MASTRA_PROJECT_ID` plus `MASTRA_PLATFORM_ACCESS_TOKEN`. This flag does not disable observability configured by the hosting platform. Verify the active hosted backend and use the Platform observability API with Platform authentication when applicable; the assistant's owner token is a separate credential.

Before using a hosted installation, verify unauthenticated requests are rejected, the owner can use Studio, and conversations, preferences, objectives, tasks, schedules, pending approvals and traces survive a service restart. Recover separate approval and decline cases in the same conversation and inspect the actual provider effects. Validate scheduled checks while the runtime is available and run connected examples using dedicated authorized records.

## About Mastra templates

This is an official Mastra template. Official templates live in the [Mastra monorepo](https://github.com/mastra-ai/mastra) and are synchronized to standalone repositories.

[Want to contribute?](https://github.com/mastra-ai/mastra/blob/main/templates/template-personal-assistant/CONTRIBUTING.md)
