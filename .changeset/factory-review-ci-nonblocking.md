---
'@mastra/factory': patch
---

Factory PR reviews no longer request changes because of CI status alone. Failing checks about PR metadata or process (such as a missing issue reference, title format, or labels) are reported as non-blocking findings, and a red build or test check only blocks the verdict when the reviewer reproduces the failure.
