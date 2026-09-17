---
'mastracode': patch
---

Fixed a raw `cd <path>` prefix still showing at the start of shell command output. The prefix is now stripped when the path is quoted, separated by `;` or a newline, or preceded by whitespace, and the working directory is shown in the command footer instead.
