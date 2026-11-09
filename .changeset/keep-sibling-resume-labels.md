---
'@mastra/core': patch
---

Fixed resume labels being cleared when one of several suspended steps is resumed. Previously, resuming one step in a `.parallel()` or `.branch()` block dropped the labels of every other step that was still suspended, so `getResumeLabels()` returned `{}` and label-based recovery could resume the wrong step. Labels of steps that are still suspended now stay on the run until those steps are resumed.
