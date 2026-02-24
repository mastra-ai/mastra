# Test Prompts for Sandbox + Filesystem Combos

These prompts test whether the agent can write a file via the filesystem API
and then read it back via a sandbox shell command. This exposes the
sandbox/filesystem mismatch when they don't share the same backing store.

## Prompt (same for all three agents)

```
Write a file called "hello.txt" with the content "hello from the agent" to the workspace.
Then use a shell command to cat that same file and tell me what you see.
If the shell command fails or shows different content, explain why.
```

## Expected Results

### 1. Developer Agent (E2B + LocalFilesystem mount at /local)

- `write_file("/local/hello.txt", "hello from the agent")` → writes to local disk
- E2B sandbox has the `/local` mount — but LocalFilesystem has no `getMountConfig()`,
  so no FUSE mount is created. The file exists on the controller's disk, not in the
  E2B container.
- `execute_command("cat /local/hello.txt")` → likely fails or shows different content
  (the E2B container's `/local` directory is empty or doesn't exist)

### 2. Local S3 Mount Agent (LocalSandbox + S3 mount at /s3)

- `write_file("/s3/hello.txt", "hello from the agent")` → writes to S3 via API
- `execute_command("cat /s3/hello.txt")` → tries to read `/s3/hello.txt` from local
  disk, which doesn't exist. Should fail with "No such file or directory".
- The local mount at `/local` should work fine for both API and sandbox.

### 3. Local S3 Direct Agent (LocalSandbox + S3 as primary filesystem)

- `write_file("/hello.txt", "hello from the agent")` → writes to S3 via API
- `execute_command("cat /hello.txt")` → tries to read `/hello.txt` from local disk
  root, which either doesn't exist or is a different file entirely.
- Total disconnect between what the API sees and what shell commands see.
