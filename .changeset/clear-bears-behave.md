---
'@mastra/playground-ui': patch
---

Added controlled snapshot frame selection to SankeySignals. The component now requires selectedFrameId and onFrameIdChange props, so the host application owns which timeline snapshot is displayed (for example to persist and restore it). Timeline clicks, snapshot playback, and perspective changes all report the new frame through onFrameIdChange. The playground signals overview page resolves the initial frame from the snapshot list and passes it down.
