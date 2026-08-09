---
'mastracode': patch
---

Keep input typed while the TUI is handling a slash command or a `!` shell command. Submitting during that window used to be swallowed — the editor cleared, nothing ran, and the text was gone — because the input loop had already moved on and no longer had a read pending. Submissions made while the loop is busy are now held and delivered in order on its next read, so a quick sequence like:

```
!echo hi
/browser clear viewport
```

runs both commands instead of only the first.
