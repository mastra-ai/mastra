---
'@mastra/factory': patch
---

The activity line under the transcript now follows the whole run instead of disappearing at the first output. It shows the agent indicator and says what the run is doing (thinking, reading a file, running a command, using a skill, updating memory, waiting for you), then lands on done or on the failure before it fades out. It steps aside while the answer streams, since the words arriving already say it, and the run then ends quietly instead of showing "Updating memory" or "Done" under the answer.

When the agent starts calling tools, the indicator moves onto the activity row for those calls without flickering, and that row names the call in progress from the moment it starts instead of reading "Thinking" until the first result lands.
