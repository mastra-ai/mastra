# Recipe: use a theme controller in React

Create the controller in a module. Read it with `useThemeController`:

```tsx
import { useEffect } from 'react';
import { useThemeController } from '@pierre/theming/react';

import { themeController } from './theme-controller';

export function ThemeControls() {
  const state = useThemeController(themeController);

  useEffect(() => {
    document.documentElement.dataset.colorScheme = state.resolvedColorScheme;
  }, [state.resolvedColorScheme]);

  return (
    <button
      type="button"
      onClick={() =>
        themeController.setColorMode(
          state.resolvedColorScheme === 'dark' ? 'light' : 'dark'
        )
      }
    >
      Use {state.resolvedColorScheme === 'dark' ? 'light' : 'dark'} mode
    </button>
  );
}
```

Pass `state.resolvedTheme` to code or tree surfaces. Use `normalizeThemeColors`
when a React component needs workbench UI colors.
