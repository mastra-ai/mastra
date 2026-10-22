---
'@mastra/server-adapters-test-suite': patch
---

Server adapters tested with the shared route suite now pass for the MCP server event routes (`/mcp/:serverId/events/:eventName/poll`, `/stream`, `/emit`) and `POST /observability/spans/aggregate`. The suite now registers a test event on its MCP server, supplies the `eventName` path param and an emit payload, runs the dev-only emit route with `MASTRA_DEV` set, and mocks span aggregation support.
