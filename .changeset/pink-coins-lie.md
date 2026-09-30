---
'@mastra/factory': patch
---

Fixed web OAuth device sign-in (GitHub Copilot, OpenAI Codex) telling a second concurrent poll to wait for the entire remaining sign-in window. It now retries after 250 ms while another poll is in progress.
