---
'mastracode': minor
---

**Start Mastra Code with a prompt already sent**

```sh
mastracode --initial-prompt "Review the changes on this branch"
# or, from a launcher that only passes environment variables through
MASTRACODE_INITIAL_PROMPT="Review the changes on this branch" mastracode
```

This opens the interactive TUI and sends the text as the first message, then keeps the session open for follow-ups. Unlike `--prompt`, which runs headless and exits, this is for launchers and scripts that want to hand off to a normal session.

The prompt can also come from `MASTRACODE_INITIAL_PROMPT`, for launchers that can only pass environment variables through (a terminal multiplexer, an editor pane, a wrapper). Mastra Code removes the variable at startup, so shells and nested Mastra Code sessions it starts never send the same prompt again. The flag wins when both are set, and piped stdin still works — it follows the prompt in the same first message.

The first message (from the flag, the variable, or piped stdin) now renders once in the transcript instead of twice.
