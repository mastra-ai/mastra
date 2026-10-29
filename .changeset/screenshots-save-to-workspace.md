---
'@mastra/agent-browser': minor
---

`browser_screenshot` can now also save the screenshot as a PNG in the agent's workspace. Pass a `path` and the agent can attach or share the file afterwards without setting up its own browser. Missing folders are created. Saving follows the workspace's write-file settings, so nothing is saved when writing is turned off or needs approval. If the screenshot can't be saved, for example because the agent has no workspace, the model still gets the image along with the reason.

```json
{ "path": "screenshots/home.png" }
```
