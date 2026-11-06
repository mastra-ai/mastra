# Personal Assistant

A personal assistant for questions, planning, and writing that remembers your response preferences across conversations and restarts. Connect services through Mastra Connect to retrieve source information and review external changes before approving them in Studio.

## Why we built this

Repeating the same preferences in every conversation adds friction. This assistant keeps a shared owner profile while preserving each conversation's history separately.

## Prerequisites

- **[OpenAI API key](https://platform.openai.com/api-keys)**: set `OPENAI_API_KEY` for the default `openai/gpt-6-luna` model. Your account needs access to that model; `ASSISTANT_MODEL` can select another OpenAI model available to your account.
- **[Mastra Connect credentials](https://mastra.ai/docs/mastra-platform/connect)** (optional): set `MASTRA_PROJECT_ID` and `MASTRA_PLATFORM_ACCESS_TOKEN` together after creating a Platform project and app access token. `MASTRA_PLATFORM_SECRET_KEY` is the native fallback. Connect accounts in that project separately; the OpenAI key does not authorize access to them.
- This local version supports one owner per installation and listens on `127.0.0.1`. Goals and schedules are not configured.
- Conversations, preferences, and native traces persist in `.data/assistant.db` without automatic expiration. `ASSISTANT_DATA_DIR` changes the directory, relative to the template root or an absolute path. Keep your database private; deleting it removes the installation's stored context.

## Quickstart 🚀

1. **Open the local template**
   - From your existing Mastra checkout, run `cd templates/template-personal-assistant`.
   - Run `npm install --workspaces=false && npm run setup` to install dependencies and create `.env` without replacing an existing file.
2. **Add your API key**
   - Fill in `.env` using the setting described under Prerequisites.
3. **Start the dev server**
   - Run `npm run dev` and open [Mastra Studio](http://127.0.0.1:4111).
   - Select **Personal Assistant** and send “Help me plan a focused morning.” The assistant should suggest a practical plan in the conversation.

## Try it out

- Say “Remember that I prefer concise bullet points.” Ask a follow-up question and look for the saved response style.
- Stop and restart the server, open a new conversation, and ask for a morning plan. The assistant can use the same saved preference in the new thread.
- Return to your original conversation to find its earlier messages. Separate conversations share preferences while retaining separate histories.
- With Connect configured, ask “Check my connected services and summarize this Gmail message: `<message ID>`.” Supported full plain-text bodies are decoded; unsupported or incomplete content is identified.
- Ask to create a document containing your reviewed draft. Review each pending tool call and its arguments, then approve or decline it in Studio. A blank document is incomplete; failed insertion should retain its document ID.

## Customization

- Open the project in your coding agent and describe a change, such as “Adapt the assistant to help me prepare weekly learning plans. Explore the code and propose a plan before making changes.”
- Edit instructions and the working-memory template in `src/mastra/assistant.ts`. Optional `.env` settings include `ASSISTANT_OWNER_ID` (default `local-owner`), `ASSISTANT_MAX_STEPS` (1–20, default 20), and `ASSISTANT_TIMEZONE` (an IANA timezone). Keep the owner ID stable to retain access to existing context.

To enable connected tools, follow the linked Connect setup, add the optional credentials to `.env`, and authorize the services you need. `ASSISTANT_CONNECT_PROVIDERS` accepts a JSON array of provider IDs and defaults to `["google-mail","google-docs","notion","jira"]`. `ASSISTANT_CONNECT_TOOLS` optionally restricts the available exact tool keys; it does not change provider OAuth permissions. Optional `MASTRA_ORG_ID` and `MASTRA_PLATFORM_REGION` follow the native Connect configuration.

The developer-owned read registry in `src/mastra/connect.ts` currently permits only `google_mail_get_message` without confirmation. Every other connected tool, including unfamiliar read operations, requires native approval. Connections refresh before runs and recovery; unresolved providers are reported as unavailable rather than empty sources. One owner's scope includes project-global connections. Review project access before connecting sensitive accounts.

Approval decisions apply to the pending run and stored arguments. Return to the same conversation after restarting to recover pending calls. Retrieved content cannot grant permissions. Full plain-text email decoding is limited to 64 KiB, 64 MIME parts and eight nested levels; attachments and HTML-only content are unsupported. External mutations can fail partially or have uncertain results. Inspect existing provider references before deciding to retry; the template adds no automatic mutation retry.

For a built local server, run `npm run build` and then `npm start`. Both use the same configured database as development. This version provides local operation; hosted authentication and remote storage are not configured.

## About Mastra templates

This template is being developed in the [Mastra monorepo](https://github.com/mastra-ai/mastra). It is currently available from this local checkout.

[Want to contribute?](https://github.com/mastra-ai/mastra/blob/main/CONTRIBUTING.md)
