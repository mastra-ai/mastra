---
'@mastra/code-sdk': patch
---

Update results now include their parts as separate fields (`via`, `command`, `details`, `installDir`, `runningVersion`, `ranWith`, `managedBy`) alongside `message`, so callers can lay them out.

Added `planUpdate(pm, version)`, which decides how an update will run without changing anything: an install (with the tool and command), or no install with the result to show instead, for example when Homebrew owns the install. `performUpdate` follows the same plan, and accepts one you already showed the user:

```ts
const plan = await planUpdate(pm, latestVersion);
if (plan.willInstall) {
  console.log(`Installing with ${plan.via}: ${plan.command}`);
  const outcome = await performUpdate(pm, latestVersion, plan);
}
```
