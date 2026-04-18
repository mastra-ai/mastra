---
'@mastra/core': minor
---

Improved `PROCESSOR_RUN` spans to record hook-specific input and changed output instead of broad internal processor state. Processor traces now keep replayable `messages` and `systemMessages`, summarize model and tool configuration, omit `messageList` instances, raw stream chunk payloads, and model usage, and only include output message arrays when a processor actually changed them.

**If you consume traces**

Update any dashboards or parsers that depend on the previous `PROCESSOR_RUN` payload shape. Some fields are now summarized, omitted, or only present when changed.

**Example**

A `processInputStep` span now records a normalized model summary with `modelId`, `provider`, and `specificationVersion`, and a summarized tools list with `id`, `name`, and `description` instead of the full step configuration.
