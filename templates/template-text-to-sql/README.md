# Chat with Database

A Mastra template that lets you query a local SQLite database using natural language. An AI agent introspects the schema, converts your questions to SQL, and executes the queries. Built with [Mastra](https://mastra.ai).

## Why we built this

Text-to-SQL is a classic problem that showcases the power of AI agents to understand complex schemas, reason about data, and generate executable code. This template demonstrates how to build a conversational SQL agent using Mastra's tools and architecture. It's a great starting point for anyone looking to create AI agents that interact with databases, whether for analytics, customer support, or internal tools.

## Demo

<video controls width="640" height="360" src="https://res.cloudinary.com/mastra-assets/video/upload/v1772538183/template-text-to-sql_pgibmm.mp4"></video>

This demo runs in Mastra Studio, but you can connect this agent to your React, Next.js, or Vue app using the [Mastra Client SDK](https://mastra.ai/docs/server/mastra-client) or agentic UI libraries like [AI SDK UI](https://mastra.ai/guides/build-your-ui/ai-sdk-ui), [CopilotKit](https://mastra.ai/guides/build-your-ui/copilotkit), or [Assistant UI](https://mastra.ai/guides/build-your-ui/assistant-ui).

## Quick start

1. **Clone the template**
   - Run `npx create-mastra@latest --template text-to-sql` to scaffold the project locally.
2. **Add your API key**
   - Copy `.env.example` to `.env` and fill in your OpenAI API key.
3. **Start the dev server**
   - Run `npm run dev` and open [localhost:4111](http://localhost:4111) to try it out.

Open Studio and start chatting with the SQL agent. The agent can introspect the database schema, convert your natural language questions into SQL queries, and return the results.

> Need a database to try? The template comes with a pre-seeded SQLite database (`data.db`) containing sample company and employee data.

### Example Queries

- "What tables are in the database?"
- "Show me all employees at Acme Corp"
- "What's the average salary by department?"
- "Which projects are currently in progress and what's their total budget?"
- "List employees hired in 2023 sorted by salary"
- "Which company has the highest revenue?"

## Making it yours

This template is a starting point. Here are some ideas to make it your own:

- Connect to a different database (PostgreSQL, MySQL, etc.) by swapping out the database client and adjusting the introspection and execution tools.
- Add authentication and user management to control access to the database.
- Implement more advanced SQL features like JOINs, subqueries, or transactions.
- Build a custom frontend using the Mastra Client SDK or UI libraries to create a polished user interface.

## About Mastra templates

[Mastra templates](https://mastra.ai/templates) are ready-to-use projects that show off what you can build — clone one, poke around, and make it yours. They live in the [Mastra monorepo](https://github.com/mastra-ai/mastra) and are automatically synced to standalone repositories for easier cloning.

Want to contribute? See [CONTRIBUTING.md](https://github.com/mastra-ai/mastra/blob/main/templates/template-text-to-sql/CONTRIBUTING.md).
