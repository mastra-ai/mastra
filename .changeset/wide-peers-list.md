---
'mastracode': patch
---

With **Experimental cross-agent communication** on in `/settings`, `agent_connections_list` now also lists Mastra Code instances running in other projects on the same machine, and you can connect to and message them. Before, the list only showed instances in the current project. Restart each instance after updating so they can find each other.

Also fixed Mastra Code leaving its signal socket files under `/tmp/mc` behind on exit.
