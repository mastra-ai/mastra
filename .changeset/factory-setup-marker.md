---
'@mastra/factory': minor
---

Session start checks for the `.mastra-sandbox/setup` marker beside the checkout and skips the setup command when the marker holds the sha256 digest of the project's current setup command. Sandboxes booted from a warm repo template carry the marker already; setup runs once when it is missing or stale and writes the marker afterwards.
