---
'@mastra/e2b': minor
'@mastra/s3': minor
'@mastra/gcs': minor
---

E2B sandboxes can run agent commands as a second, unprivileged OS user, and S3 and GCS mounts can name the user that owns their files.

`E2BSandbox` takes a `user` option. Every command the agent runs — `executeCommand` and background processes alike — runs as that user instead of the template's default user, which has to keep `sudo` because mounting needs it. Without the option, nothing changes.

`S3Filesystem` and `GCSFilesystem` take an `owner` option, `{ uid, gid }`. It sets the ownership of the files inside the mount, so a command user other than the one that mounts can read and write them. Without it, the mount keeps probing the default user's uid and gid.

Together, the two options let an agent work as a user that cannot read the credentials mounted into the sandbox or become root:

```ts
const workspace = new Workspace({
  mounts: {
    '/s3-data': new S3Filesystem({
      bucket: 'my-bucket',
      region: 'us-east-1',
      owner: { uid: 1001, gid: 1001 },
    }),
  },
  sandbox: new E2BSandbox({ user: 'agent' }),
})
```

The `user` must already exist in the sandbox template.
