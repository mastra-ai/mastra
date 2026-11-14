---
'@mastra/core': patch
---

Fixed `execute_command` reporting exit code 0 when a command piped to `tail` failed and `/bin/sh` is a dash without `pipefail` (Debian, Ubuntu 22.04 and 24.04). The last pipeline of the command now reports the exit code of its last failing stage, as `pipefail` does. The command still runs in the configured shell, so its words expand the same way, and bash is not needed.
