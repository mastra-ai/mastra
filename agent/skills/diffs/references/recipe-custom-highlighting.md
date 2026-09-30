# Recipe: register custom highlighting

Register a language or theme before the first surface uses it:

```ts
import { registerCustomLanguage, registerCustomTheme } from '@pierre/diffs';

registerCustomLanguage(
  'my-language',
  () => import('./my-language.tmLanguage.json'),
  ['myext']
);

registerCustomTheme('my-theme', () => import('./my-theme.json'));
```

Set `file.lang` to the custom language name. Set `options.theme` to the custom
theme name. Use `registerCustomCSSVariableTheme` when CSS variables supply the
theme colors.
