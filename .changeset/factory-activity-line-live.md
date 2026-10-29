---
'@mastra/factory': patch
---

The activity line under the transcript now follows the whole run instead of disappearing at the first output. It shows the agent indicator and says what the run is doing (thinking, reading a file, running a command, using a skill, updating memory, waiting for you), then lands on done or on the failure before it fades out. It steps aside while the answer streams, since the words arriving already say it, and the run then ends quietly instead of flashing "Done" under the answer.

When a run opens a tool stretch, the indicator moves onto the stretch's header in place: no blank frame, no fade from nothing, and the header names the call in progress from the moment it starts instead of reading "Thinking" until the first row lands.
