---
'@mastra/cloudflare-sandbox': patch
---

Fixed `CloudflareSandbox` silently running commands and file operations on the container's temporary disk when a storage mount could not be verified or restored. Operations now wait for in-flight mounts and fail with a clear error if a mount check fails, a re-mount fails, or the initial mount failed; they recover automatically once the mount succeeds again. A missing or malformed bridge exit status is now treated as a failure instead of success.
