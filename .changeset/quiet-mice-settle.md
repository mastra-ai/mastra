---
'@mastra/code-sdk': minor
---

Added an `inputMouseMode` preference to global settings (`GlobalSettings.preferences.inputMouseMode`). It defaults to `false` and controls whether the Mastra Code TUI input box captures the mouse while you type.

```ts
import { loadSettings, saveSettings } from '@mastra/code-sdk/onboarding/settings';

const settings = loadSettings();
settings.preferences.inputMouseMode = true;
saveSettings(settings);
```
