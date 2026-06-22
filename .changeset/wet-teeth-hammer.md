---
'@mastra/playground-ui': patch
'@mastra/playground': patch
---

Move the Memory Studio (timeline, flamegraph, and observational-memory detail) into the agent chat view as an opt-in right-side panel. The standalone Memory nav entry, `/memory` routes, and the separate thread/chat list are removed. The panel is toggled from the chat header and via an in-panel checkbox, and clicking the flamegraph timeline drives a replay cursor that highlights the matching observational-memory record. Marker types are imported from `@mastra/memory` instead of being redeclared in the UI so the studio stays in sync with the stream format.
