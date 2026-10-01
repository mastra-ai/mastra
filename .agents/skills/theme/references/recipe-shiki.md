# Recipe: use a Pierre theme with Shiki

Install the package:

```bash
pnpm add @pierre/theme shiki
```

Import the theme object and pass it to Shiki:

```ts
import pierreDark from '@pierre/theme/pierre-dark';
import { codeToHtml } from 'shiki';

const html = await codeToHtml(source, {
  lang: 'typescript',
  theme: pierreDark,
});
```

Import a matching light and dark pair when the app supports both color schemes.
Use the `theming` skill when the user can change the active theme at runtime.
