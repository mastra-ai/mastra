---
name: testing-mastracode-tui
description: Testing mastracode TUI features interactively in Konsole. Covers model configuration, thread lifecycle, task state isolation, and common blockers.
---

# Testing Mastracode TUI

Guide for interactive testing of mastracode's terminal UI in Konsole.

## Devin Secrets Needed

- `OPENROUTER_API_KEY` — for using OpenRouter as a custom provider when Anthropic/OpenAI keys are unavailable

## Prerequisites

1. Build mastracode and its dependencies:

   ```bash
   cd /home/ubuntu/repos/mastra
   COREPACK_ENABLE_STRICT=0 pnpm build:mastracode
   ```

   This may take a few minutes. If `pnpm` has corepack issues, install directly: `npm install -g pnpm@10.11.0`

2. If unit tests fail with missing `@mastra/core/workspace`, run `pnpm build:core` first.

## Configuring a Custom Provider (OpenRouter)

If you don't have a direct Anthropic/OpenAI API key, configure OpenRouter as a custom provider:

1. Edit `~/.local/share/mastracode/settings.json`:

   ```json
   {
     "customProviders": [
       {
         "name": "OpenRouter",
         "url": "https://openrouter.ai/api/v1",
         "apiKey": "<OPENROUTER_API_KEY value>",
         "models": ["minimax/minimax-m2.7"]
       }
     ],
     "models": {
       "activeModelPackId": "custom:Custom",
       "modeDefaults": {
         "build": "openrouter/minimax/minimax-m2.7",
         "plan": "openrouter/minimax/minimax-m2.7",
         "fast": "openrouter/minimax/minimax-m2.7"
       }
     },
     "customModelPacks": [
       {
         "name": "Custom",
         "models": {
           "build": "openrouter/minimax/minimax-m2.7",
           "plan": "openrouter/minimax/minimax-m2.7",
           "fast": "openrouter/minimax/minimax-m2.7"
         },
         "createdAt": "2026-01-01T00:00:00.000Z"
       }
     ]
   }
   ```

2. After launching mastracode, you may also need to activate the custom pack via `/models` → select "Custom" → "Activate".

3. Verify the status bar at the bottom shows the correct model (e.g., `build openrouter/minimax/minimax-m2.7`).

## Launching Mastracode

```bash
cd /home/ubuntu/repos/mastra/mastracode
COREPACK_ENABLE_STRICT=0 pnpm cli
```

## Key TUI Commands

| Command    | Action                                           |
| ---------- | ------------------------------------------------ |
| `/new`     | Create a new empty thread                        |
| `/threads` | Open thread selector (↑↓ navigate, Enter select) |
| `/clone`   | Clone current thread                             |
| `/models`  | Switch model pack                                |
| `/help`    | Show all available commands                      |

## Testing Thread State Isolation

The key scenario for thread state testing:

1. **Generate tasks**: Ask the model to use the `task_write` tool explicitly. Some models (e.g., minimax) may not call it automatically — you may need to say something like: "Please use the task_write tool to create a task list with 3 items: Fix login bug, Add unit tests, Update docs"

2. **Verify tasks visible**: Look for the "Tasks [0/N completed]" section with ○/▶/✓ icons between the status line and the editor input.

3. **Test `/new`**: The task progress component should completely disappear. The screen should show only "Ready for new conversation" and an empty input.

4. **Test `/threads` switch**: Switch back to the original thread — messages and tasks should restore correctly.

5. **Test `/clone`**: Cloned threads should start with empty tasks (tasks are ephemeral, not persisted to clones).

## Common Issues

- **Observational memory errors**: You may see errors about `GOOGLE_GENERATIVE_AI_API_KEY` for the OM model. Fix this by setting the OM model to an OpenRouter model via `/om` or in settings.json (`models.omModelOverride`). Configure the OM model if you expect observation to trigger during testing.
- **Model not calling tools**: Less capable models may not use mastracode's tool system. Explicitly instruct them to use specific tools by name.
- **Status bar shows wrong model**: After changing settings.json, you may need to use `/models` in the TUI to activate the custom pack.
- **Build failures**: If `pnpm cli` fails with module resolution errors, run `pnpm build:mastracode` from the repo root to build all transitive dependencies.

## Running Unit Tests

```bash
cd /home/ubuntu/repos/mastra
COREPACK_ENABLE_STRICT=0 pnpm --filter mastracode exec vitest run src/tui/__tests__/
```

Some pre-existing test failures may exist in the broader test suite — focus on tests relevant to the feature being verified.
