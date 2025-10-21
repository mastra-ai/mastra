---
title: "Runtime Context "
description: Learn how to use Mastra's RuntimeContext to provide dynamic, request-specific configuration to agents.
---

# Runtime Context

Agents use `RuntimeContext` to access request-specific values sent alongside user messages. These values let a single agent change its behavior, functionality, model, tools, or memory usage based on the needs of each request.

![Agents Runtime Context](/img/agents/agents-runtime-context.jpg)

## When to use `RuntimeContext`

Use `RuntimeContext` when an agent's behavior should change based on the request or environment. For example, you might switch models or storage providers based on user details, or adjust instructions or tool selection based on the user's language.

## Configuring agents with `RuntimeContext`

You can access the `runtimeContext` argument from any of the agent’s supported parameters. These functions can be sync or `async`, allowing you to use context values to fetch data, apply logic, or adjust behavior at runtime.

```typescript {3,6,9,12} filename="src/dynamic-agent.ts" showLineNumbers copy
export const dynamicAgent = new Agent({
  name: "dynamic-agent",
  instructions: async ({ runtimeContext }) => {
    // ...
  },
  model: ({ runtimeContext }) => {
    // ...
  },
  tools: ({ runtimeContext }) => {
    // ...
  },
  memory: ({ runtimeContext }) => {
    // ...
  },
});
```

You can also use `runtimeContext` with other parameters like `agents`, `workflows`, `scorers`, `inputProcessors`, and `outputProcessors`.

> See [Agent](../../reference/agents/agent.md) for a full list of configuration options.

## Setting values

To set variables in `runtimeContext`, create a new instance using `new RuntimeContext()` and call `.set()` to define the values you want to include.

The `.set()` method takes two arguments:

1. **key**: The name used to identify the value.
2. **value**: The data to associate with that key.

After setting the values, pass the `runtimeContext` to `.generate()` or `.stream()` to make them available to the agent.

```typescript {8,11} filename="src/test-dynamic-agent.ts" showLineNumbers copy
import { mastra } from "./mastra";
import { RuntimeContext } from "@mastra/core/runtime-context";
import { UserTier } from "./mastra/agents/dynamic-agent"

const agent = mastra.getAgent("dynamicAgent");

const runtimeContext = new RuntimeContext<UserTier>();
runtimeContext.set("user-tier", "enterprise");

const response = await agent.generate("Help plan my day.", {
  runtimeContext
});
```

## Accessing values

The example below accesses a `user-tier` value from `runtimeContext` to determine which model and instructions to use. The context is typed to provide safety and autocomplete when working with `.get()` and `.set()`.

```typescript {12,19} filename="src/mastra/agents/dynamic-agent.ts" showLineNumbers copy
import { openai } from "@ai-sdk/openai";
import { Agent } from "@mastra/core/agent";
import { RuntimeContext } from "@mastra/core/runtime-context";

export type UserTier = {
  "user-tier": "enterprise" | "pro";
};

export const dynamicAgent = new Agent({
  name: "dynamic-agent",
  instructions: async ({ runtimeContext }: { runtimeContext: RuntimeContext<UserTier> }) => {
    const userTier = runtimeContext.get("user-tier");

    const result = await db.query("SELECT instructions FROM config WHERE tier = ?", [userTier]);

    return result[0].instructions;
  },
  model: ({ runtimeContext }: { runtimeContext: RuntimeContext<UserTier> }) => {
    const userTier = runtimeContext.get("user-tier");

    return userTier === "enterprise"
      ? openai("gpt-4o-mini")
      : openai("gpt-4.1-nano");
  }
});
```

## Related

- [Tool Runtime Context](../tools-mcp/runtime-context.md)
- [Server Middleware Runtime Context](../server-db/middleware.md)
