---
'@mastra/factory': patch
---

Transcript rows share one line style. Tool calls, reasoning, signals, notifications, skills and the "Thinking" indicator show an icon and a label, with a chevron only when there is more to show. A state signal names its state and shows its mode as a badge. A row whose message fits on its line no longer offers a disclosure that only repeats the line, and a tool call with nothing to show, including one that returned `null` or an empty result, has no disclosure at all.
