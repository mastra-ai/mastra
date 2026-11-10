---
'@mastra/code-sdk': minor
---

Added `mouseDialogs` and `mouseInput` preferences to global settings (`GlobalSettings.preferences`). Both default to `false` and control whether the Mastra Code TUI uses the mouse in dialogs and slash suggestions, and in the input box while you type.

```ts
import { loadSettings, saveSettings } from '@mastra/code-sdk/onboarding/settings';

const settings = loadSettings();
settings.preferences.mouseDialogs = true;
settings.preferences.mouseInput = true;
saveSettings(settings);
```
