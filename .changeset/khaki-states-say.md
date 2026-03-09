---
'@mastra/playground-ui': minor
---

Added **Playground** and **Traces** tabs to the agent detail page.

**Agent Playground tab** provides a side-by-side environment for iterating on agent configuration (instructions, tools, model settings) and testing changes in a live chat — without modifying the deployed agent. Includes version comparison, request context configuration, and the ability to trigger dataset experiments directly from the playground.

**Agent Traces tab** shows a compact table of all agent traces with columns for status, timestamp, input preview, output preview, and duration. Supports date range filtering, infinite scroll pagination, and clicking rows to inspect full trace details. Includes checkbox selection and bulk "Add to dataset" for quickly building evaluation datasets from production traces.

**Tools edit page** now shows configured (enabled) tools in a dedicated section at the top, making it easier to find and edit tools that are already in use.

**Dataset save actions** on the test chat: per-message save button on user messages and a "Save full conversation" action at the bottom of the thread.
