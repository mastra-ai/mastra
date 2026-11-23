# Knowledge Support Agent

Describe a support issue in Mastra Studio and get a next step grounded in your team's guides, policies, and past cases. The support agent searches Mastra Knowledge, cites the pages it uses, and asks follow-up questions to narrow down the problem.

[![Deploy to Mastra](https://img.shields.io/badge/Deploy_to_Mastra-18181B?style=for-the-badge)](https://projects.mastra.ai/~/projects/create/https:/github.com/mastra-ai/template-knowledge-support-agent)

## Why we built this

When a fix lives in a closed ticket or an old chat, the next technician may have to investigate the same problem from scratch. With Mastra Knowledge, a reviewer can turn a confirmed fix into guidance that other technicians can find in future conversations.

Teams can share guides while limiting access to each customer's case history. Pinned policies keep standing rules, like when to get approval before making a change, available to the agent as it works through a case.

## Prerequisites

- **[OpenAI API key](https://platform.openai.com/api-keys)**. Set `OPENAI_API_KEY` for the default `openai/gpt-4o-mini` model.

## Quickstart 🚀

1. **Open the project**
   - Run `npx create-mastra@latest knowledge-support-agent --template knowledge-support-agent`, then `cd knowledge-support-agent`.
   - If you already have the template in a checkout, open its directory and run `npm install`. In the monorepo the directory is `templates/template-knowledge-support-agent`.
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

- Use the new token from each launch to reopen an existing chat.

## Customization

- Ask your coding agent to explore the project and plan an adaptation before editing. For example, “Plan an IT help desk example with shared setup guides and private employee support cases.”
- Add cases or replace the standing policy with [Datasets and examples](docs/datasets-and-examples.md). You can also try the [software integration](docs/datasets-and-examples.md#try-the-software-integration-example) and [IT helpdesk](docs/datasets-and-examples.md#try-the-it-helpdesk-example) examples.

## Deploy to Mastra Platform

Attach a managed database to your target environment and set `DATABASE_PROVIDER` there. The platform injects the corresponding connection variables. Keep the local `.env` for Studio and configure `OPENAI_API_KEY` in the target environment. [Managed database variables](https://mastra.ai/docs/mastra-platform/system-environment-variables#managed-database-variables). With `DATABASE_PROVIDER` unset, the template detects a single attached Turso or PostgreSQL database from its variables. When both are attached, set the provider explicitly.

## About Mastra templates

This official template is maintained in the [Mastra monorepo](https://github.com/mastra-ai/mastra) and synchronized to a standalone repository.

[Want to contribute?](CONTRIBUTING.md)
