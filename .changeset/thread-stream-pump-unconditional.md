---
'@mastra/core': patch
---

Fixed threaded agent runs getting permanently stuck when no caller consumes the run's stream.

A threaded run started without an active consumer (for example a fire-and-forget wake that starts a run but never iterates the returned stream) never advanced to a terminal state, so its active-run record and thread lease were never released. Every later signal for that thread then coalesced into the stuck run instead of starting a fresh one, wedging the thread.

The thread-stream runtime now always drives a registered run's stream to completion, even when nobody subscribes. The broadcast tee still buffers every part, so a later or external subscriber replays the full stream unchanged.
