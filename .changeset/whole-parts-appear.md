---
'@mastra/daytona': patch
---

Fixed Daytona S3 mounts to forward temporary session credentials, protect credential uploads, and remove temporary staging files after launch. Added a bounded mount-access check and recovery so failed mounts can be retried. Long-lived credential files are cleaned up on unmount once the mount process has exited, including after reconnecting to a sandbox. Credentials are not automatically refreshed.

Previously, `sessionToken` was used for host-side S3 requests but dropped by Daytona mounts. Now pass all three temporary credential values to `S3Filesystem` to authenticate the mounted filesystem too:

```typescript
import { Workspace } from '@mastra/core/workspace';
import { DaytonaSandbox } from '@mastra/daytona';
import { S3Filesystem } from '@mastra/s3';

const workspace = new Workspace({
  mounts: {
    '/s3-data': new S3Filesystem({
      bucket: process.env.S3_BUCKET!,
      region: process.env.S3_REGION ?? 'us-east-1',
      endpoint: process.env.S3_ENDPOINT,
      accessKeyId: process.env.SCOPED_S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.SCOPED_S3_SECRET_ACCESS_KEY!,
      sessionToken: process.env.SCOPED_S3_SESSION_TOKEN!,
    }),
  },
  sandbox: new DaytonaSandbox({ language: 'python', ephemeral: true }),
});
```

Obtain credentials from your storage provider with only the permissions the sandbox needs.
