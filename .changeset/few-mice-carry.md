---
'@mastra/code-sdk': patch
---

Added `skipGlobalInstructions` to session state. When set, a session ignores the agent instruction files in the machine's home directory (`~/.claude/CLAUDE.md`, `~/.mastracode/AGENTS.md`, and the other supported locations) and reads only the ones in the project it works on. Servers that run sessions on behalf of other people set it so a run never inherits the personal configuration of whoever hosts the process.

Seed it on the controller to cover every session it creates:

```ts
prepareAgentControllerMount({
  initialState: { skipGlobalInstructions: true },
});
```

Sessions you drive yourself are unaffected and still read your home directory instructions.
