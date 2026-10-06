---
'mastra': patch
---

`mastra connect` list/add/remove now auto-load `.env` and `.env.local` from
the current directory, so `MASTRA_API_TOKEN`, `MASTRA_ORG_ID`, and
`MASTRA_PROJECT_ID` no longer need to be exported by hand. Already-exported
variables still win.

Each command also shows a spinner while it is fetching the catalog,
checking project and organization connections, or removing a connection,
instead of sitting silent for several seconds.
