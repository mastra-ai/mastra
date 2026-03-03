---
'@mastra/blaxel': patch
---

Fixed command timeouts in Blaxel sandboxes so long-running commands now respect configured limits.

Changed the default Blaxel image to `blaxel/ts-app:latest` (Debian-based), which supports both S3 and GCS mounts out of the box.

Added distro detection for mount scripts so S3 mounts work on Alpine-based images (e.g. `blaxel/node:latest`) via `apk`, and GCS mounts give a clear error on Alpine since gcsfuse is unavailable.

Removed working directory from sandbox instructions to avoid breaking prompt caching.
