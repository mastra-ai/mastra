---
'mastra': patch
---

Added `factory intake-route reroute-preview` and `factory intake-route reroute` to `mastra api`, for listing and moving untouched cards whose intake route now points at a different board.

```sh
mastra api factory intake-route reroute-preview <factoryProjectId>
mastra api factory intake-route reroute <factoryProjectId>
```
