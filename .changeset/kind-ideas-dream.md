---
'@mastra/livekit': minor
---

Added a voice benchmark runner, controlled CI reply fixture, scenario definitions, latency summaries, and a converter for Mastra dataset experiment results. Real-audio trials use an application-supplied adapter; the kit does not provision rooms or phone infrastructure.

```ts
// Before: collect and aggregate each trial in application code.
const result = await runScenario(scenario);

// After: repeat trials with a watchdog and retain every outcome.
const results = await runVoiceBenchmarks({
  scenarios: [scenario],
  iterations: 5,
  mode: 'audio',
  measurement: 'server-playout',
  startup: 'warm',
  versions: { livekitAgents: '1.9.0', adapter: '1' },
  run: runScenario,
});
const summary = summarizeVoiceBenchmarks(results);
```

Reports distinguish first audio, first useful answer, and completed playback. Failures and timeouts remain in the success-rate denominator; missing measurements remain unavailable.
