# File-based agent example (`weather-fs`)

This directory is a **file-based agent**. Unlike the other agents in this
example (which are created with `new Agent()` and exported from
`agents/index.ts`), this agent is defined purely by file convention and is
**not** registered anywhere in code. `mastra dev` and `mastra build` discover it
automatically.

It exercises every file-based capability: config, instructions, tools, skills,
memory, a default workspace with seed files, and a declared subagent.

## Layout

```text
weather-fs/
  config.ts                       # model + config overrides (uses agentConfig() for typing)
  instructions.md                 # the agent instructions
  memory.ts                       # default-exported Memory instance, wired in as the agent memory
  tools/
    get_weather.ts                # default-exported tool, keyed by filename -> "get_weather"
  skills/
    units.md                      # flat skill: filename is the name, body is the instructions
    severe-weather/
      SKILL.md                    # packaged skill: frontmatter name/description + body
      references/
        thresholds.md             # inlined and exposed to the skill at runtime
  workspace/                      # seed files mirrored into the agent's workspace
    cities.json
    README.md
  subagents/
    forecaster/                   # a declared subagent, same layout as an agent
      config.ts                   # MUST set a description
      instructions.md
      tools/
        get_forecast.ts
```

## How it maps

| File / dir                       | Becomes                                                                         |
| -------------------------------- | ------------------------------------------------------------------------------- |
| `config.ts`                      | merged agent config; `id`/`name` default to `weather-fs`.                       |
| `instructions.md`                | the agent `instructions`.                                                       |
| `memory.ts`                      | the agent `memory` (default export).                                            |
| `tools/get_weather.ts`           | a tool keyed `get_weather`.                                                     |
| `skills/units.md`                | a flat skill named `units`.                                                     |
| `skills/severe-weather/SKILL.md` | a packaged skill; frontmatter supplies name/description, `references/` inlined. |
| `workspace/`                     | seed files copied into the agent's default workspace.                           |
| `subagents/forecaster/`          | a subagent the parent can delegate to via a tool named `forecaster`.            |

Subagents are **one level deep** and each subagent's `config.ts` must set a
non-empty `description` — that is what the parent model sees when deciding
whether to delegate.

## Try it

From the repo root:

```bash
pnpm --filter ./examples/agent mastra dev
```

Open Studio and you'll see **weather-fs** listed alongside the code-defined
agents. Try:

- "what's the weather in Tokyo?" — calls `get_weather`, reports °C and °F.
- "give me a 5-day forecast for London" — delegates to the `forecaster` subagent.
- Ask about a storm — the `severe-weather` skill prepends a safety note.

See the full docs at `/docs/agents/file-based-agents`.
