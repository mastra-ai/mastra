---
'@mastra/posthog': minor
---

Added optional PostHog export for Mastra operational logs.
Log export is off by default, so existing tracing setups do not send new events until you opt in.

Enable log export with defaults:

```ts
new PosthogExporter({
  apiKey: process.env.POSTHOG_API_KEY,
  logs: true,
});
```

Customize log export:

```ts
new PosthogExporter({
  apiKey: process.env.POSTHOG_API_KEY,
  logs: {
    eventName: 'mastra_log',
    minLevel: 'warn',
    distinctId: event => event.log.correlationContext?.userId,
    captureExceptions: true,
    dedupe: true,
  },
});
```

Added `mastra_log` events with trace and span links, user and session identifiers, and structured log fields.
Use `eventName`, `minLevel`, `distinctId`, `captureExceptions`, and `dedupe` to customize export behavior.
Privacy mode redacts message and custom payload fields while preserving correlation fields.
