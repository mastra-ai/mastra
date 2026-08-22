---
'@internal/playground': patch
---

Stopped showing an empty "Tool arguments" block in Studio for tools the provider runs itself.

OpenAI's `web_search`, `mcp` and `image_generation` declare an empty input schema, so their call badge opened onto `{}`. The section is now left out when there is no input to show.
