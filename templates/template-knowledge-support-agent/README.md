# Knowledge Support Agent

Give a support agent your guides, policies, and case history in Mastra Knowledge. When a technician describes a problem in Studio, the agent retrieves evidence it can access, cites the sources, and asks for observations needed to narrow the diagnosis. A reviewer can publish a confirmed finding so another technician can reuse it in a later conversation.

[![Deploy to Mastra](https://img.shields.io/badge/Deploy_to_Mastra-18181B?style=for-the-badge)](https://projects.mastra.ai/~/projects/create/https:/github.com/drantunes/mastra/tree/feat/template-knowledge-support-agent/templates/template-knowledge-support-agent)

## Why we built this

Support teams repeat investigations when manuals, customer history, and confirmed fixes are scattered across tickets and chats. Mastra Knowledge gives each kind of information a durable home. Scoped access lets teams reuse shared guidance while keeping each customer's case history private.

## Prerequisites

- Set `OPENAI_API_KEY` for the default `openai/gpt-4o-mini` model. [Get an OpenAI API key](https://platform.openai.com/api-keys)

## Quickstart 🚀

1. **Open the project**
   - Run `npx create-mastra@latest knowledge-support-agent --template knowledge-support-agent`, then `cd knowledge-support-agent`.
   - If you already have the template in a checkout, open its directory and run `npm ci`. In the monorepo the directory is `templates/template-knowledge-support-agent`.
2. **Add your API key**
   - Run `cp .env.example .env` and set the key from Prerequisites.
3. **Load the example Knowledge**
   - Run `npm run knowledge:seed -- --dry-run` to preview the pages and their scopes.
   - Run `npm run knowledge:seed` to load the retail support guides and policy into the local database.
4. **Start Studio**
   - Run `npm run dev` and copy the `retailops-store-42` token from the private credential file whose path the launcher prints.
   - Open [Mastra Studio](http://127.0.0.1:4111) with `?auth_header=Bearer%20YOUR_TOKEN` appended to the URL. Replace `YOUR_TOKEN` with the copied token and keep the resulting URL private.
   - Select **Support**, open a new chat, and ask “My Square Terminal loses Wi-Fi connectivity. What should I check?” Look for a citation to the network guide and a question about which connection indicator is visible.

## Try it out

- Ask “Can I factory reset while offline payments are pending?” Look for guidance based on the pinned policy to preserve the pending payments.
- Run `npm run knowledge:seed -- --dataset retail-pos-history`, then ask about Store 42 connectivity in a fresh chat. Look for dated cases and which observations remain open.
- Use the [Studio walkthrough](docs/studio-walkthrough.md) to record an attributed confirmation, approve a fictional finding, then retrieve the approved tenant guidance in another technician's chat.

For a built HTTP deployment with remote LibSQL or PostgreSQL and external OAuth identity, follow [Provider-neutral staging](docs/hosted-staging.md).

The default database is `.local/support.db`. It keeps your Knowledge and conversations across restarts. Use the new token from each launch to reopen an existing chat.

## Customization

- Ask your coding agent to explore the project and plan an adaptation before editing. For example, “Plan an IT help desk example with shared setup guides and private employee support cases.”
- Follow [Datasets and examples](docs/datasets-and-examples.md) to add cases, replace the standing policy, or try the software integration and Portuguese IT helpdesk examples.

## About Mastra templates

This official template is maintained in the [Mastra monorepo](https://github.com/mastra-ai/mastra) and synchronized to a standalone repository.

[Want to contribute?](CONTRIBUTING.md)
