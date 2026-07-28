---
'@mastra/code-sdk': patch
---

Fix sandbox file tools failing in Factory sessions. `SandboxFilesystem` now accepts absolute paths that already live under the session workdir (the agent prompt advertises the workdir, so tools are called with fully-qualified paths that previously got re-joined onto the workdir and reported "Path not found"). Also replaced GNU-only shell usage (`stat -c`, `find -printf`) with portable equivalents so view/write/list tools work on macOS-hosted local sandboxes, not just Linux VMs.
