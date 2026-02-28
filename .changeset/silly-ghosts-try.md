---
'@mastra/daytona': patch
---

Added early connectivity check for GCS mounting that detects Daytona's restricted internet tiers and fails fast with an actionable error message instead of hanging. Also improved gcsfuse installation with distro-aware codename detection (bookworm for Debian, jammy for Ubuntu) for environments where Google Cloud is reachable.
