# GenUI Data Explorer

Ask questions about your data and explore the answers with interactive charts, tables, and metric
cards. A Mastra agent selects React components from a catalog to present each answer in a CopilotKit
chat. Start with the included sample Sales dataset to try generative UI without connecting your own
database.

## Why we built this

A text answer is not always the best way to explore data. Trends need charts, comparisons need
context, and individual records need tables. This template shows how to build generative UI with
Mastra: the agent chooses what to display as the conversation evolves, while your components control
how it looks and behaves.

## Prerequisites

- **Node.js 24.15.0 or later** and NPM.
- **[OpenAI API key](https://platform.openai.com/api-keys)**: set `OPENAI_API_KEY` in `.env` for the
  default `gpt-4.1-mini` model. Optionally set `ANALYSIS_MODEL` to another OpenAI model ID available
  to your account.

## Quickstart 🚀

1. **Create the project**
   - Run `npx create-mastra@latest genui-data-explorer --template genui-data-explorer`.
   - Run `cd genui-data-explorer`, then `npm install`.
2. **Add your API key**
   - Run `cp .env.example .env` and fill in the key described under Prerequisites.
3. **Start the app**
   - Run `npm run dev`. This starts the Mastra server and web app and prepares the sample data
     automatically on the first run.
   - Open [the data explorer](http://127.0.0.1:3000) and ask “Show monthly bookings over the last
     twelve complete months.” Look for a trend chart with the underlying values.

## Try it out

- Ask “Compare bookings by segment over the last twelve complete months” to see a ranked comparison.
- Follow up with “Show the same analysis for SMB” to explore a filtered view.
- Ask “Show closed-won opportunity records for the last complete month” to inspect a table of deals.
- Ask “Show a customer retention cohort heatmap for the last twelve complete months” to explore
  retention by activation month.
- Use **Correct this view** to change an answer's interpretation. The correction updates that card
  without changing source records. Return through **Chat history** to continue a saved conversation.

## Customization

- Ask your coding agent: “Add a compact bookings summary component and teach the agent when to choose
  it. Explore the code and propose a plan before making changes.” Follow
  [Adding UI components](docs/ui-components.md) for catalog registration, rendering, and selection instructions.
- Connect your own data or adapt the example to another domain. See [Data sources](docs/data-sources.md)
  for the source contract and related Mastra templates for databases, PDFs, CSVs, and documents.

For the startup flow, server/client boundaries, and independent deployment commands, see
[Architecture and deployment](docs/architecture.md).

## About Mastra templates

[Mastra templates](https://mastra.ai/templates) are starting points you can run, explore, and adapt.
Official templates live in the [Mastra monorepo](https://github.com/mastra-ai/mastra) and are
synchronized to standalone repositories.

[Want to contribute?](./CONTRIBUTING.md)
