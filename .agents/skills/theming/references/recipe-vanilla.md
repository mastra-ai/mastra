# Recipe: use a theme controller in vanilla JavaScript

Create a controller with the one-controller or multiple-controller recipe. Apply
each state change to the document:

```ts
import { normalizeThemeColors } from '@pierre/theming/color';
import { themeController } from './theme-controller';

function applyTheme() {
  const state = themeController.getState();
  document.documentElement.dataset.colorScheme = state.resolvedColorScheme;

  if (state.resolvedTheme == null) return;
  const { colors } = normalizeThemeColors(state.resolvedTheme);
  document.documentElement.style.setProperty(
    '--app-background',
    colors?.['editor.background'] ?? state.resolvedTheme.bg ?? ''
  );
  document.documentElement.style.setProperty(
    '--app-foreground',
    colors?.['editor.foreground'] ?? state.resolvedTheme.fg ?? ''
  );
}

applyTheme();
const unsubscribe = themeController.subscribe(applyTheme);
```

Call `themeController.setColorMode(mode)` from a mode control. Call
`setThemeNameForScheme(scheme, name)` from a theme selector. Call
`unsubscribe()` when the host no longer needs updates.
