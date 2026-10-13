---
'@mastra/factory': minor
---

New chats now start on your default model and thinking level. Before, a new chat stayed on the built-in model even when you had set a default.

**Defaults**

- A new chat starts on your personal default model and thinking level. If you have none, it starts on the Factory's default model.
- A chat keeps the model and thinking level it started with. Changing your default later does not change chats that already exist.
- `PUT /web/config/default-model` now takes `thinkingLevel` and saves it together with the model. A request without `thinkingLevel` clears the saved level, so an old level never ends up paired with a new model. `GET /web/config/default-model` returns both fields.

  ```diff
  - PUT /web/config/default-model  { "modelId": "anthropic/claude-opus-4-6" }
  + PUT /web/config/default-model  { "modelId": "anthropic/claude-opus-4-6", "thinkingLevel": "high" }
  ```

**Thinking**

- Factory no longer reads thinking defaults from the shared settings file. A run that has no thinking level of its own uses `off`. If your deployment set a level under Settings → Thinking defaults, set it again as your personal default.
- Removed `GET /web/config/thinking`, `PUT /web/config/thinking`, and the `MASTRACODE_DEPLOYMENT_ORGANIZATION_ID` environment variable.

**Permissions**

- When auth is on, only organization admins can change a Factory's default model. Other members get a 403 but can still edit the rest of the project.
