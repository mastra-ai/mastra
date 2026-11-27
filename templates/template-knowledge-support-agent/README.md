# Knowledge Support Agent

Describe a support issue in Mastra Studio and get a next step grounded in your team's guides, policies, and past cases. The support agent searches Mastra Knowledge, cites the pages it uses, and asks follow-up questions to narrow down the problem.

<a class="inline-block mt-3" href="https://projects.mastra.ai/~/projects/create/https:/github.com/mastra-ai/template-knowledge-support-agent" aria-label="Deploy to Mastra Platform"><img src="https://svgbutton.com/v1/button.svg?paddingX=2&paddingY=2" alt="Deploy to Mastra Platform" width="114" height="38" /></a>

## Why we built this

When a fix lives in a closed ticket or an old chat, the next technician may have to investigate the same problem from scratch. With Mastra Knowledge, a reviewer can turn a confirmed fix into guidance that other technicians can find in future conversations.

Teams can share guides while limiting access to each customer's case history. Pinned policies keep standing rules, like when to get approval before making a change, available to the agent as it works through a case.

## Demo

<video controls width="640" height="360" src="https://res.cloudinary.com/mastra-assets/video/upload/v1795620320/Mastra_Knowledge_bsferd.mp4"></video>

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
- Use the [Studio walkthrough](https://github.com/mastra-ai/mastra/blob/main/templates/template-knowledge-support-agent/docs/studio-walkthrough.md) to record a technician's observation, approve it, and find the shared guidance in another technician's chat.
- Reopen a saved chat using the token from your latest Studio launch.

## Customization

- Ask your coding agent to explore the project and suggest a plan before editing. For example, “Adapt this template for a field service team with shared equipment guides and a separate case history for each site.”
- Add cases or replace the standing policy with [Datasets and examples](https://github.com/mastra-ai/mastra/blob/main/templates/template-knowledge-support-agent/docs/datasets-and-examples.md). You can also try the [software integration](https://github.com/mastra-ai/mastra/blob/main/templates/template-knowledge-support-agent/docs/datasets-and-examples.md#try-the-software-integration-example) and [IT helpdesk](https://github.com/mastra-ai/mastra/blob/main/templates/template-knowledge-support-agent/docs/datasets-and-examples.md#try-the-it-helpdesk-example) examples.

## Deploy to Mastra Platform

**Deploy** to Mastra Platform to create a project from this template. Attach a managed Turso, Neon, or PostgreSQL database to your environment. Mastra sets the database connection variables automatically. [Managed databases](https://mastra.ai/docs/mastra-platform/database)

<a class="inline-block mt-3" href="https://projects.mastra.ai/~/projects/create/https:/github.com/mastra-ai/template-knowledge-support-agent" aria-label="Deploy to Mastra Platform"><img src="https://svgbutton.com/v1/button.svg?paddingX=2&paddingY=2" alt="Deploy to Mastra Platform" width="114" height="38" /></a>

Set these environment variables in the platform dashboard.

- `OPENAI_API_KEY` with your OpenAI API key.
- `DATABASE_PROVIDER` with `turso`, `neon`, or `postgres` to match the attached database.
- `MASTRA_ORGANIZATION_ID` with the ID of the organization that owns the project.
- `MASTRA_PLATFORM_STUDIO_AUTH=disabled` so Studio uses the template's Mastra sign-in and access rules.

The database needs the example Knowledge before Support can answer questions. For a fresh database, `SUPPORT_SEED_ON_STARTUP=true` loads the example on first start when the deployment includes the dataset packaged by `npm run build`.

## About Mastra templates

This official template is maintained in the [Mastra monorepo](https://github.com/mastra-ai/mastra) and synchronized to a standalone repository.

[Want to contribute?](https://github.com/mastra-ai/mastra/blob/main/templates/template-knowledge-support-agent/CONTRIBUTING.md)
