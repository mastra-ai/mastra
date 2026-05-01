---
'mastracode': minor
---

Free-text answers to the `ask_user` tool can now span multiple lines. Press
`Shift+Enter` or `\+Enter` to insert a newline, `Enter` to submit, and `Esc`
to cancel — long answers wrap inside the input box instead of scrolling
horizontally off-screen, and the raw text (including indentation and trailing
newlines) is forwarded to the agent intact.

Slash-command prompts that take short answers (paths, names, yes/no, model
picks) keep the existing single-line input, so muscle memory for those
prompts is unchanged.

Internally, this is opt-in via a new `multiline: true` flag on
`AskQuestionInlineComponent` / `AskQuestionDialogComponent`. The flag also
flows through `createStreaming` and `activate`, so the multiline editor is
available everywhere those components are mounted.
