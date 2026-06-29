# File-based agent example (`weather-fs`)

This directory is a **file-based agent**. Unlike the other agents in this
example (which are created with `new Agent()` and exported from
`agents/index.ts`), this agent is defined purely by file convention and is
**not** registered anywhere in code. `mastra dev` and `mastra build` discover it
automatically.

## Layout

```
weather-fs/
  config.ts            # model + config overrides (uses agentConfig() for typing)
  instructions.md      # the agent instructions
  tools/
    get_weather.ts     # default-exported tool, keyed by filename -> "get_weather"
  workspace/           # seed files mirrored into the agent's workspace
    cities.json
    README.md
```

## How it maps

| File / dir              | Becomes                                                    |
| ----------------------- | --------------------------------------------------------- |
| `config.ts`             | merged agent config; `id`/`name` default to `weather-fs`. |
| `instructions.md`       | the agent `instructions`.                                 |
| `tools/get_weather.ts`  | a tool keyed `get_weather`.                               |
| `workspace/`            | seed files copied into the agent's default workspace.     |

## Try it

From the repo root:

```bash
pnpm --filter ./examples/agent mastra dev
```

Open Studio and you'll see **weather-fs** listed alongside the code-defined
agents. Ask it "what's the weather in Tokyo?" — it calls `get_weather` and can
read `cities.json` from its workspace.

See the full docs at `/docs/agents/file-based-agents`.
