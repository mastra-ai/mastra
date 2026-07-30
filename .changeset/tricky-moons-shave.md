---
'@mastra/factory': patch
---

Retry a git clone or pull that loses its connection to github.com mid-transfer. A single HTTP/2 framing glitch or dropped connection used to fail opening a workspace outright, because git reports it as a non-zero exit rather than a transport error. Refusals (bad credentials, missing repo, blocked egress) still fail immediately instead of being retried into a slower failure.
