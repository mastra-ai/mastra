---
'@mastra/factory': patch
---

Transcript rows share one line style. Tool calls, signals, notifications, skills and the "Thinking" indicator use the same icon, label and chevron. A state signal names its state and shows its mode as a badge. A row whose message fits on its line no longer offers a disclosure that only repeats the line, and a tool call with nothing to show, including one that returned `null`, has no disclosure at all.
