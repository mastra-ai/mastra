---
'@mastra/playground-ui': patch
---

Processor spans in Studio traces now open with a readable Preview instead of JSON only. The preview shows the pipeline phase, the messages a processor received, the messages and system messages it changed, and tool, step and chunk details where the phase records them.

The Attributes section also gains a Preview for processor spans: executor, pipeline position, hook duration, message-list changes as readable actions (added, removed, cleared), and a tripwire as a blocked run with its reason and retry state. Attributes the preview does not explain stay in JSON, so no value is shown twice.

The Preview / JSON toggle still keeps the exact stored payload one click away, and processor spans recorded before the phase was tracked keep their JSON view. Both the full span panel and the compact span details use the same presentation.
