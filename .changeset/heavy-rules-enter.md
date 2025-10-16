---
'mastra': minor
---

- Remove the `mastra deploy` CLI command. Use the deploy instructions of your individual platform.
- Remove `--env` flag from `mastra build` command
- Remove `--port` flag from `mastra dev`. Use `server.port` on the `new Mastra()` class instead.
- Validate `--components` and `--llm` flags for `mastra create` and `mastra init`
