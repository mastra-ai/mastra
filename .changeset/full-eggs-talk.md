---
'@mastra/code-sdk': patch
---

Fixed hooks running twice for sessions started in your home directory. There, the project hooks file (`~/.mastracode/hooks.json`) is the same file as the global one, and it was loaded as both. It is now loaded once, including when the project directory is a symlink to your home directory.
