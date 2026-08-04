# File-based agents

This example is a minimal project for testing Mastra's file-based agent conventions. The `city-guide` agent is discovered from its directory and is not registered in `src/mastra/index.ts`.

```text
src/mastra/
  index.ts
  agents/
    city-guide/
      config.ts
      instructions.md
      tools/
        get_city_fact.ts
```

## Run the example

Copy `.env.example` to `.env` and add your OpenAI API key. Then install dependencies and start Mastra Studio:

```bash
pnpm install --ignore-workspace
pnpm mastra dev
```

Open the `city-guide` agent and ask:

> Tell me a fact about Tokyo.

The agent should call `get_city_fact` and answer with the returned fact.
