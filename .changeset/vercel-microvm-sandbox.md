---
'@mastra/vercel': minor
---

Added `VercelMicroVMSandbox`, a new workspace sandbox provider backed by the [Vercel Sandbox](https://vercel.com/docs/vercel-sandbox) ephemeral Firecracker MicroVM product (`@vercel/sandbox`). It provides a persistent in-session filesystem, `sudo` access, exposed ports, command execution, and background processes via the process manager. This is distinct from the existing `VercelSandbox`, which runs commands as stateless Vercel serverless Functions and is unchanged. Also exports `VercelMicroVMProcessManager` and the `vercelMicroVMSandboxProvider` editor descriptor (provider id `vercel-microvm`). Closes #16704.
