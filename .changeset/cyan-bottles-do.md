---
'@mastra/core': patch
---

Fixed `execute_command` reporting exit code 0 for a failing `cmd | tail -N` when `/bin/sh` is a dash without `pipefail` (Debian, Ubuntu 22.04 and 24.04). The command now runs under `bash -o pipefail` when bash is installed, so the failing stage sets the exit code again.
