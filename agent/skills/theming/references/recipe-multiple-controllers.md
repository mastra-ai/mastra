# Recipe: use multiple theme controllers

Use multiple controllers when independent areas need different modes,
selections, storage, or lifecycles. Share one resolver when those areas use the
same theme loaders and cache.

```ts
import {
  createThemeCatalog,
  createThemeController,
  createThemeResolver,
} from '@pierre/theming';
import { themes } from '@pierre/theming/themes';

const catalog = createThemeCatalog({
  themes,
  defaultLightThemeName: 'pierre-light',
  defaultDarkThemeName: 'pierre-dark',
});

const resolver = createThemeResolver();

export const workspaceTheme = createThemeController({
  catalog,
  resolver,
  storageKey: 'workspace-theme',
});

export const previewTheme = createThemeController({
  catalog,
  resolver,
  defaultMode: 'light',
  storageKey: 'preview-theme',
});
```

Subscribe each area to its own controller. Call `destroy()` on each controller
when its area is removed. Use distinct storage keys when selections must remain
independent.
