---
'@mastra/core': minor
---

Added maxDurationMs, maxWidth, and maxHeight options to BrowserRecordingOptions. These can now be set on the recording config object to provide defaults for every recording, instead of relying on agent instructions to pass them to the tool at start time.

```ts
const browser = new AgentBrowser({
  recording: {
    outputDir: './recordings',
    maxDurationMs: 60_000,
    maxWidth: 1280,
    maxHeight: 720,
  },
});
```

Per-recording overrides via the browser_record tool still take precedence.
