---
'@mastra/daytona': patch
---

Fixed Daytona S3 mounts to forward temporary session credentials, protect credential uploads, and remove temporary staging files after launch. Added a bounded mount-access check and recovery so failed mounts can be retried. Credentials are not automatically refreshed.
