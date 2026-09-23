---
'mastracode': minor
---

**Added `--tui-initial-prompt` and `--tui-prompt` to start Mastra Code with a message already sent**

```sh
# sent only when there is no earlier conversation for this directory to resume
mastracode --tui-initial-prompt "/skill/review-pr https://github.com/org/repo/pull/1"

# sent even when the directory's last conversation is resumed
mastracode --tui-prompt "Pick up where we left off and run the tests"

# for launchers that can only pass environment variables (works like --tui-initial-prompt)
MASTRACODE_TUI_INITIAL_PROMPT="Review the changes on this branch" mastracode
```

The interactive TUI opens and submits the text as if you had typed it, so slash commands and skills work, and the session stays open for follow-ups. Use `--prompt` instead for headless runs that exit when done.

- Mastra Code removes `MASTRACODE_TUI_INITIAL_PROMPT` at startup, so shells and nested sessions don't send the prompt again. A flag wins over the variable.
- Piped stdin follows a plain-text prompt in the same message, and is skipped with it when `--tui-initial-prompt` resumes a conversation. A prompt starting with `/` or `!` can't be combined with piped stdin; Mastra Code exits with an error instead of passing the piped text to the command.

**Fixed the first message rendering twice** in the transcript when Mastra Code starts with piped stdin or a startup prompt.
