---
'@mastra/code-sdk': patch
'mastracode': patch
---

Mastra Code no longer keeps signal sockets in the shared `/tmp/mc` directory, where another account on the same machine could create the directory first and then answer thread-owner lookups, receive thread messages or hold thread leases. Sockets now live in a directory only your user can access: `$TMPDIR/mc` on macOS, `$XDG_RUNTIME_DIR/mc` (or `/run/user/<uid>/mc`) on Linux, and `/tmp/mc-<uid>` otherwise. Mastra Code creates it with mode `0700` and refuses a symlink, a directory owned by another user, or one other users can access; it then logs a warning and runs without signals between instances. `MASTRACODE_SIGNALS_SOCKET_ROOT` still overrides the location.

Instances on earlier versions can't reach updated instances or share their thread leases, so restart every Mastra Code instance after updating. The old `/tmp/mc` directory is left in place; delete it once no instance uses it. If instances started from different environments (for example a launch agent, `ssh` or `tmux`) can't see each other, set `MASTRACODE_SIGNALS_SOCKET_ROOT` to the same path for all of them.
