---
'@mastra/factory': minor
---

Removed global Work and Review lifecycle configuration. Installed board definitions now exclusively supply phase entry and exit handlers; custom boards declare them through defineBoard(). Work and Review remain installed automatically, and built-in customization is deferred. Global rules retain shared audit version and tool-result handlers.

Remove former rules.work and rules.review overrides. For a custom board, declare handlers on phases instead:

```typescript
const releaseBoard = defineBoard({
  id: 'release',
  title: 'Release',
  initialPhase: 'queued',
  phases: {
    queued: { title: 'Queued', onEnter: { manual: () => undefined } },
  },
});
new MastraFactory({ storage, boards: [releaseBoard] });
```

The web deployment now uses guarded built-in intake: only eligible linked GitHub arrivals automatically invoke factory-triage. Manual and noncandidate arrivals no longer start solely from entering Intake. Explicit triage and existing approval safeguards remain unchanged.
