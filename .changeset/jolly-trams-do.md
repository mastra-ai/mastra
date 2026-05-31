---
'mastracode': patch
---

Added configurable shell passthrough for direct TUI `!` commands. You can now choose which shell runs `!` commands via `settings.json` or environment variables, with support for POSIX shells, `cmd.exe`, and PowerShell.

```json
{
  "shellPassthrough": {
    "mode": "path",
    "executable": "/bin/zsh",
    "family": "posix"
  }
}
```

Or via environment variables:

```sh
export MASTRACODE_SHELL=/bin/zsh
export MASTRACODE_SHELL_MODE=path
```

The default behavior is preserved when no configuration is set.
