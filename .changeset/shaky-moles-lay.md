---
'@mastra/playground-ui': patch
---

Fixed `pill-ghost` tabs looking too airy after the dark-theme scaling pass. Tabs in a `<TabList variant="pill-ghost">` now render with the exact ghost Button recipe (28px height, 13px text, same padding, hover and focus styles), the list no longer adds its own padding and uses a tighter gap, and the active pill fills the full tab height. Consumers no longer need to pass padding overrides to `Tab` or `TabList`.
