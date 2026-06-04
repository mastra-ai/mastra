---
'@mastra/core': minor
---

Added SignalProvider abstraction for building notification signal providers. Enables declarative `signals: [new GithubSignals()]` wiring in Agent config with built-in subscription tracking, polling lifecycle, and webhook support. Includes WebhookSignalProvider as a proof-of-concept.
