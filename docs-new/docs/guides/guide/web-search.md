---
title: "Web Search"
description: "A step-by-step guide to creating an agent that can search the web."
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Building an Agent that can search the web

When building a web search agent, you have two main strategies to consider:

1. **Native search tools from the LLM**: Certain language models offer integrated web search capabilities that work out of the box.
2. **Implement a custom search tool**: Develop your own integration with a search provider's API to handle queries and retrieve results.

## Prerequisites

- Node.js `v20.0` or later installed
- An API key from a supported [Model Provider](/docs/models)
- An existing Mastra project (Follow the [installation guide](/docs/getting-started/installation) to set up a new project)

## Using native search tools

Some LLM providers include built-in web search capabilities that can be used directly without additional API integrations. OpenAI's GPT-4o-mini and Google's Gemini 2.5 Flash both offer native search tools that the model can invoke during generation.

### Install dependencies

<Tabs>
<TabItem value="openai" label="Open AI">
```bash
npm install @ai-sdk/openai
```
</TabItem>
<TabItem value="gemini" label="Gemini">
```bash
npm install @ai-sdk/google
```
</TabItem>
</Tabs>

### Define the Agent

Create a new file `src/mastra/agents/searchAgent.ts` and define your agent:

<Tabs>
<TabItem value="openai" label="Open AI">
```ts title="src/mastra/agents/searchAgent.ts"
import { Agent } from "@mastra/core/agent";

export const searchAgent = new Agent({
name: "Search Agent",
instructions:
"You are a search agent that can search the web for information.",
model: 'openai/gpt-4o-mini',
});

````
</TabItem>
<TabItem value="gemini" label="Gemini">
```ts title="src/mastra/agents/searchAgent.ts"
import { Agent } from "@mastra/core/agent";

export const searchAgent = new Agent({
    name: "Search Agent",
    instructions:
        "You are a search agent that can search the web for information.",
    model: 'google/gemini-2.5-flash',
});
````

</TabItem>
</Tabs>

### Setup the tool

<Tabs>
<TabItem value="openai" label="Open AI">
```ts title="src/mastra/agents/searchAgent.ts" {9-11}
import { openai } from "@ai-sdk/openai";
import { Agent } from "@mastra/core/agent";

export const searchAgent = new Agent({
name: "Search Agent",
instructions:
"You are a search agent that can search the web for information.",
model: 'openai/gpt-4o-mini',
tools: {
webSearch: openai.tools.webSearch()
}
});

````
</TabItem>
<TabItem value="gemini" label="Gemini">
```ts title="src/mastra/agents/searchAgent.ts" {9-11}
import { google } from "@ai-sdk/google";
import { Agent } from "@mastra/core/agent";

export const searchAgent = new Agent({
    name: "Search Agent",
    instructions:
        "You are a search agent that can search the web for information.",
    model: 'google/gemini-2.5-flash',
    tools: {
        webSearch: google.tools.googleSearch()
    }
});
````

</TabItem>
</Tabs>

### Register the Agent with Mastra

In your `src/mastra/index.ts` file, register the agent:

```ts title="src/mastra/index.ts" {2,5}
import { Mastra } from "@mastra/core";
import { searchAgent } from "./agents/searchAgent";

export const mastra = new Mastra({
  agents: { searchAgent },
});
```

### Test your agent

You can test your agent inside Mastra's [Playground](../../getting-started/studio.md) using the `mastra dev` command:

```bash
mastra dev
```

Inside Playground navigate to the **"Search Agent"** and ask it: "What happened last week in AI news?"

## Using Search APIs

For more control over search behavior, you can integrate external search APIs as custom tools. [Exa](https://exa.ai/) is a search engine built specifically for AI applications, offering semantic search, configurable filters (category, domain, date range), and the ability to retrieve full page contents. The search API is wrapped in a Mastra tool that defines the input schema, output format, and execution logic.

### Install dependencies

```bash
npm install exa-js
```

### Define the Agent

Create a new file `src/mastra/agents/searchAgent.ts` and define your agent:

```ts title="src/mastra/agents/searchAgent.ts"
import { Agent } from "@mastra/core/agent";

export const searchAgent = new Agent({
  name: "Search Agent",
  instructions:
    "You are a search agent that can search the web for information.",
  model: "openai/gpt-4o-mini",
});
```

### Setup the tool

```ts title="src/mastra/tools/searchTool.ts"
import { createTool } from "@mastra/core/tools";
import z from "zod";
import Exa from "exa-js";

export const exa = new Exa(process.env.EXA_API_KEY);

export const webSearch = createTool({
  id: "exa-web-search",
  description: "Search the web",
  inputSchema: z.object({
    query: z.string().min(1).max(50).describe("The search query"),
  }),
  outputSchema: z.array(
    z.object({
      title: z.string().nullable(),
      url: z.string(),
      content: z.string(),
      publishedDate: z.string().optional(),
    }),
  ),
  execute: async ({ context }) => {
    const { results } = await exa.searchAndContents(context.query, {
      livecrawl: "always",
      numResults: 2,
    });

    return results.map((result) => ({
      title: result.title,
      url: result.url,
      content: result.text.slice(0, 500),
      publishedDate: result.publishedDate,
    }));
  },
});
```

### Add to your Agent

```ts title="src/mastra/agents/searchAgent.ts"
import { webSearch } from "./tools/searchTool";

export const searchAgent = new Agent({
  name: "Search Agent",
  instructions:
    "You are a search agent that can search the web for information.",
  model: "openai/gpt-4o-mini",
  tools: {
    webSearch,
  },
});
```

### Register the Agent with Mastra

In your `src/mastra/index.ts` file, register the agent:

```ts title="src/mastra/index.ts" {2,5}
import { Mastra } from "@mastra/core";
import { searchAgent } from "./agents/searchAgent";

export const mastra = new Mastra({
  agents: { searchAgent },
});
```

### Test your agent

You can test your agent inside Mastra's [Playground](../../getting-started/studio.md) using the `mastra dev` command:

```bash
mastra dev
```

Inside Playground navigate to the **"Search Agent"** and ask it: "What happened last week in AI news?"
