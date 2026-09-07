---
'@mastra/factory': patch
---

Opening a factory thread while its run is mid-step now shows the step as it stands, the streamed text and the running tool, instead of the "What can I help you build?" prompt under a bare "Thinking" line. Review sessions kicked off from the board hit this on every run: their first step checks out the pull request, and the thread looked idle for that whole window. The empty prompt now waits until the run state is known and no run is busy.
