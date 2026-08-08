---
'mastracode': patch
---

Added a configurable model for Stagehand browser automation, which previously ran on a fixed default. Run `/browser set model` with no value to choose from a picker, or name one directly:

```bash
/browser set model anthropic/claude-sonnet-4-5
/browser clear model
```

Only providers Stagehand supports are accepted, and you are prompted for the provider's API key when it is missing.
