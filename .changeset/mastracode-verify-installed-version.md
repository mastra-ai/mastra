---
"mastracode": patch
---

Fixed the auto-updater falsely reporting success when the update landed somewhere the running binary doesn't use. Previously any exit code 0 from the package manager was treated as success, so if Mastra Code was installed by a different tool (for example via a wrapper that puts a shim on your PATH), `npm install -g` could update a copy you never run and Mastra Code would still tell you to restart onto the "new" version.

Mastra Code now verifies the install before and after updating when the install location and version are detectable:

- Before installing, it checks that the running binary lives in the package manager's global directory when that directory can be determined. If it doesn't (for example when the install is managed by another tool), it skips the pointless install and tells you immediately which install to update instead.
- When the install is owned by a tool it recognizes, it delegates the update to that tool: vite-plus installs are updated by running `vp install -g` for you, and Homebrew installs (under any prefix, including Linuxbrew) get the exact `brew upgrade mastracode` command to run.
- On Windows, update commands now run through a shell so the package managers' `.cmd` shims launch correctly.
- When the installed version is readable, it only reports "Updated" when the running binary changed to the target version.
- If the package manager reports success but the running binary is unchanged, it tells you honestly that your installation is managed by another tool and to update it with that tool, instead of claiming success.
- When an update fails, it now surfaces the package manager's error output so you can see the cause, rather than just "Auto-update failed".
