---
'mastra': patch
---

Fixed `mastra init` writing a corrupted API key to `.env` on Windows. The key was appended with a shell `echo`, so `cmd.exe` left a stray backslash before every `=` and a trailing space on the value. Keys containing `=`, including base64-padded Google and Azure credentials, were written unusable, and the project failed to authenticate with no warning from the CLI.
