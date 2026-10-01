---
'@mastra/docker': patch
---

Fixed `DockerSandbox` reporting its default image instead of the running container's image after reconnecting, in both `getInfo()` and the agent instructions.
