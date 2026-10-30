---
'@mastra/memory': patch
---

Observational memory hook extractors now receive the tracing context of the Observer or Reflector run that produced the observations. `onExtracted` gets a new `observabilityContext` field that you can spread into `agent.generate()` or `agent.stream()` options so the work a hook starts appears under the `memory: observe` or `memory: reflect` span instead of as a separate trace.

```typescript
new Extractor({
  name: 'Status review',
  mode: 'hook',
  async onExtracted({ rawObservations, observabilityContext }) {
    await reviewAgent.generate(`Review these observations:\n${rawObservations}`, {
      ...observabilityContext,
    })
  },
})
```

The built-in subconscious curate and remind agents use it, so their runs now nest under the observation that triggered them. The curate agent previously produced no traces at all. Structured extractor calls are also traced inside the `memory: observe` and `memory: reflect` spans rather than beside them.
