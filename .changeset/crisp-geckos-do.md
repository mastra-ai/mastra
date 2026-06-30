---
'mastracode': minor
---

Added voice input to the MastraCode TUI. Enable it with /voice, then hold the spacebar to dictate a prompt and release to finish. Your speech streams into the input in real time as you talk and is transcribed with OpenAI Whisper. The setting persists across restarts.

Requires an OpenAI API key (set `OPENAI_API_KEY` or configure it via `/api-keys`) and a local audio recorder on your `PATH` — `rec`/`sox` (recommended for live streaming) or `ffmpeg` on macOS, and `pw-record`/`parecord`/`arecord`/`sox` on Linux.
