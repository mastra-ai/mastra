---
'@mastra/daytona': patch
---

Fixed relative paths in executeCommand missing FUSE mounts when cwd is omitted. Commands now default to the first mount path, so relative-path writes land in cloud storage instead of silently going to /home/daytona.
