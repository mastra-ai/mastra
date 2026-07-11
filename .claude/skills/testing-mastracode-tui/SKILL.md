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

2. If the build fails due to pre-existing DTS errors in `@mastra/core` or `@mastra/memory`, use `--continue` to let downstream packages (including mastracode) still build:

   ```bash
   COREPACK_ENABLE_STRICT=0 pnpm turbo build --filter ./mastracode --continue
   ```

3. If unit tests fail with missing `@mastra/core/workspace`, run `pnpm build:core` first.

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

On first launch, mastracode may show a setup wizard. Select "Skip" to proceed to the main TUI without configuring models interactively.

## Key TUI Commands

| Command    | Action                                           |
| ---------- | ------------------------------------------------ |
| `/new`     | Create a new empty thread                        |
| `/threads` | Open thread selector (↑↓ navigate, Enter select) |
| `/clone`   | Clone current thread                             |
| `/models`  | Switch model pack                                |
| `/help`    | Show all available commands                      |

## Programmatic Rendering Tests

For visual/rendering bugs (e.g., border alignment, padding, wrapping), writing a quick `tsx` script that directly renders the component is more reliable than visual inspection alone:

```bash
cd /home/ubuntu/repos/mastra/mastracode
npx tsx test-script.ts
```

Key approach:

- Import the component directly (e.g., `UserMessageComponent` from `./src/tui/components/user-message.js`)
- Render at specific widths and strip ANSI codes to measure visible character widths
- Assert all lines have identical visible width (for bordered components)
- Test at multiple terminal widths (40, 60, 80, 100, 120+) to catch edge cases
- Filter out trailing empty lines from `Spacer` components when measuring
- For before/after comparisons, simulate the old logic inline to confirm the bug exists

This approach catches bugs that are hard to see visually and provides concrete pass/fail evidence.

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
- **Build failures**: If `pnpm cli` fails with module resolution errors, run `pnpm build:mastracode` (or with `--continue`) from the repo root to build all transitive dependencies.
- **User message rendering without LLM**: The user message box renders immediately on Enter, before any LLM response. You can test rendering bugs without a working LLM connection — just submit a message and inspect the bordered box.

## Running Unit Tests

```bash
cd /home/ubuntu/repos/mastra
COREPACK_ENABLE_STRICT=0 pnpm --filter mastracode exec vitest run src/tui/__tests__/
```

Some pre-existing test failures may exist in the broader test suite — focus on tests relevant to the feature being verified.
