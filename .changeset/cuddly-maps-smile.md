---
'@mastra/factory': minor
---

Added background commands to Factory sessions. Turn on **Background commands** in a project's environment settings to keep commands an agent starts with `background: true` running when a run is stopped, and to tell the session when one exits: the agent gets the exit code and the last lines of output. An idle session wakes up to read them, and the woken run uses the session owner's credentials. The agent is also told not to poll them. The setting is off by default.

```bash
curl -X PATCH "$FACTORY_URL/web/factory/projects/$PROJECT/environment" \
  -H 'content-type: application/json' \
  -d '{ "backgroundToolsEnabled": true }'
```

New session routes list a session's background commands, read their output, stop them, and cancel background tasks. Anyone who can read the session can use them. With authentication on, Mastra's own sandbox process routes and `POST /api/background-tasks/:id/cancel` now answer `403` on a Factory server, because they can't tell which sessions a caller may read. The Factory UI shows background commands apart from finished ones, with a `Background` tag while they run, a row when they finish, and a panel above the composer to read their output and stop them.
