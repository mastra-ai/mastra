# Recipe: use one theme controller

Use one controller when the app shares one color mode and one light/dark theme
selection.

Create the catalog and controller in one module:

```ts
import { createThemeCatalog, createThemeController } from '@pierre/theming';
import { themes } from '@pierre/theming/themes';

export const themeCatalog = createThemeCatalog({
  themes,
  defaultLightThemeName: 'pierre-light',
  defaultDarkThemeName: 'pierre-dark',
});

export const themeController = createThemeController({
  catalog: themeCatalog,
  defaultMode: 'system',
  storageKey: 'app-theme',
});
```

Import the same controller wherever the app reads or changes theme state. Call
`destroy()` when the application tears down the controller module.
