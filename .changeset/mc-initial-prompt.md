---
'mastracode': minor
---

**Start Mastra Code with a prompt already sent**

```sh
# start a new conversation with this prompt
mastracode --initial-prompt "Review the changes on this branch"

# send it even when a conversation for this directory is resumed
mastracode --send-prompt "Pick up where we left off and run the tests"

# from a launcher that only passes environment variables through
MASTRACODE_INITIAL_PROMPT="Review the changes on this branch" mastracode
```

This opens the interactive TUI and submits the text as if you had typed it, then keeps the session open for follow-ups. Slash commands and skills work too, for example `--initial-prompt "/skill/review-pr https://github.com/org/repo/pull/1"`. Unlike `--prompt`, which runs headless and exits, this is for launchers and scripts that want to hand off to a normal session.

Mastra Code resumes the last conversation for a directory on startup. `--initial-prompt` only sends its prompt when there is nothing to resume, so relaunching in the same place doesn't repeat the task; `--send-prompt` sends it either way.

`MASTRACODE_INITIAL_PROMPT` works like `--initial-prompt`, for launchers such as a terminal multiplexer, an editor pane or a wrapper. Mastra Code removes the variable at startup, so shells and nested Mastra Code sessions it starts never send the same prompt again. A flag wins over the variable.

Piped stdin still works. With a plain-text prompt it follows the prompt in the same first message, and it's skipped along with the prompt when `--initial-prompt` finds a conversation to resume. A slash command or `!` prompt can't be combined with piped stdin: Mastra Code exits with an error instead of passing the piped text to the command. Piped stdin on its own is always sent, as before.

The first message (from a flag, the variable, or piped stdin) now renders once in the transcript instead of twice.
