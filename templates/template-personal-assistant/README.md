# Personal Assistant

A local assistant for questions, planning, and writing that remembers your response preferences across conversations and restarts. Talk to one assistant in Mastra Studio and keep personal context in a local database.

## Why we built this

Repeating the same preferences in every conversation adds friction. This assistant keeps a shared owner profile while preserving each conversation's history separately.

## Prerequisites

- **[OpenAI API key](https://platform.openai.com/api-keys)**: set `OPENAI_API_KEY` for the default `openai/gpt-6-luna` model. Your account needs access to that model; `ASSISTANT_MODEL` can select another OpenAI model available to your account.
- This local version supports one owner per installation and listens on `127.0.0.1`. External services, goals, and schedules are not configured.
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
- Ask for a draft email or a prioritized checklist. Review the proposed text in the conversation; no external account changes occur.

## Customization

- Open the project in your coding agent and describe a change, such as “Adapt the assistant to help me prepare weekly learning plans. Explore the code and propose a plan before making changes.”
- Edit instructions and the working-memory template in `src/mastra/assistant.ts`. Optional `.env` settings include `ASSISTANT_OWNER_ID` (default `local-owner`), `ASSISTANT_MAX_STEPS` (1–20, default 20), and `ASSISTANT_TIMEZONE` (an IANA timezone). Keep the owner ID stable to retain access to existing context.

For a built local server, run `npm run build` and then `npm start`. Both use the same configured database as development. This version provides local operation; hosted authentication and remote storage are not configured.

## About Mastra templates

This template is being developed in the [Mastra monorepo](https://github.com/mastra-ai/mastra). It is currently available from this local checkout.

[Want to contribute?](https://github.com/mastra-ai/mastra/blob/main/CONTRIBUTING.md)
