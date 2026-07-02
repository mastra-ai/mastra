---
"mastracode": patch
---

Fixed the auto-updater falsely reporting success when the update landed somewhere the running binary doesn't use. Previously any exit code 0 from the package manager was treated as success, so if Mastra Code was installed by a different tool (for example via a wrapper that puts a shim on your PATH), `npm install -g` could update a copy you never run and Mastra Code would still tell you to restart onto the "new" version.

Mastra Code now verifies the version that is actually running after an update:

- It only reports "Updated" when the on-disk version of the running binary really changed to the target.
- If the package manager reports success but the running binary is unchanged, it tells you honestly that your installation is managed by another tool and to update it with that tool, instead of claiming success.
- When an update fails, it now surfaces the package manager's error output so you can see the cause, rather than just "Auto-update failed".
