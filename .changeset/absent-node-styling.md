---
'@mastra/playground-ui': patch
'@mastra/client-js': patch
---

Render absent trace-signal buckets in the theme flow with a neutral fill. The intelligence theme-flow API now emits an 'absent' passthrough node for cohort traces that never produced a stage's signal (e.g. sentiment); these buckets render muted instead of taking a theme hue, stay non-drillable, and are typed via the new 'absent' node kind on ThemeNode.
