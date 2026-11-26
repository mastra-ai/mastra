---
'@mastra/playground-ui': patch
---

Settings section titles with `info` now show a muted info icon after the title. Hovering or focusing the title or the icon highlights the icon and opens the tooltip after a short delay, instead of underlining the title.

```tsx
<SettingsTitle info="Stored in this browser.">General</SettingsTitle>
```
