---
'@mastra/factory': patch
---

Opening a factory thread while its run is mid-step now shows the run as it stands: the prompt that opened it, the streamed text and the running tool, instead of the "What can I help you build?" prompt under a bare "Thinking" line. Review sessions kicked off from the board hit this on every run: their first step checks out the pull request, and the thread looked idle for that whole window. Reloading a thread parked on a question or an approval shows the prompt instead of an empty transcript, and a prompt answered from another tab or the TUI disappears when its tool call ends. The empty prompt now waits until the run state is known and no run is busy.
