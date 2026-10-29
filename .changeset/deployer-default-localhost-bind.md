---
'@mastra/deployer': patch
---

The dev server now binds to `localhost` when neither `server.host` nor `MASTRA_HOST` is set. Previously the bind host was left undefined, which Node treats as every interface, so the server was reachable on the LAN while its startup log advertised `http://localhost`. Set `MASTRA_HOST=0.0.0.0` (or `server.host`) to restore the old all-interfaces behavior when you need access from another machine or container.
