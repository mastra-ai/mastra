---
'@mastra/playground-ui': patch
---

Added ScoresDataList compound component for rendering score rows (Date, Time, Input, Entity, Score cells) matching the logs/traces DataList pattern. Refactored DataKeysAndValues.ValueLink to use the standard `as` prop for custom link components, replacing the previous `LinkComponent` prop.
