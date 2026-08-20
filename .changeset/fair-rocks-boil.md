---
'@mastra/isolated-vm': patch
---

Updated isolated-vm to version 6.2.0 to fix a critical sandbox escape vulnerability (type confusion in ExternalCopy) that could allow untrusted code to corrupt host memory and escape the sandbox.
