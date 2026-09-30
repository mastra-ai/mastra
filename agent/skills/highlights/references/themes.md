# Themes

Highlights takes Zed-compatible theme objects. Load them from
`@pierre/highlights/themes`; `@pierre/theme` supplies Shiki and VS Code objects
with a different shape.

## Load a theme

```ts
import { pierreDark } from '@pierre/highlights/themes';
import vitesseDark from '@pierre/highlights/themes/vitesse-dark';
import { themes } from '@pierre/highlights/themes/loader';

const { default: lazyTheme } = await themes['pierre-dark']();
```

| Entry                              | Exports                                                  |
| ---------------------------------- | -------------------------------------------------------- |
| `@pierre/highlights/themes`        | Camel-case named themes, `cssVariables`, and `toCSS()`   |
| `@pierre/highlights/themes/<id>`   | One theme as the default export, e.g. `pierre-dark`      |
| `@pierre/highlights/themes/loader` | `themes`, a map from bundled IDs to async module loaders |

Pass the resolved object as `theme`; a string ID is not accepted. A
`ThemeFamily` resolves to its first member. Pass `family.themes[index]` to
select another. Theme preparation is cached by object identity; create new
objects when changing values.

## Custom themes

```ts
import type { Theme } from '@pierre/highlights';

const theme = {
  name: 'App Dark',
  appearance: 'dark',
  style: {
    'editor.background': '#101010',
    'editor.foreground': '#eeeeee',
    syntax: {
      keyword: { color: '#c084fc', font_weight: 700 },
      comment: { color: '#888888', font_style: 'italic' },
    },
  },
} satisfies Theme;
```

Colors support three-, four-, six-, and eight-digit hex and numeric
`color(display-p3 ...)` values. Use the CSS-variable mode below for application
variables. Syntax scopes such as `keyword.control` inherit from their nearest
configured parent.

Theme types come from `@pierre/highlights`:

| Type                  | Shape                                                                |
| --------------------- | -------------------------------------------------------------------- |
| `Theme`               | `name`, `appearance`, `style`, and optional `cssVariables: true`     |
| `ThemeFamily`         | `themes: readonly Theme[]`, optional `name` and `author`             |
| `ThemeStyle`          | Editor colors and `syntax`, plus additional Zed style keys           |
| `ThemeSyntaxSettings` | Optional `color`, `font_style`, and `font_weight`                    |
| `ThemePlayer`         | Optional collaborator `cursor`, `selection`, and `background` colors |
| `ThemeOptions`        | Exactly one of `theme` or `themes`                                   |

Each `style.syntax` value can be a color string or `ThemeSyntaxSettings`.

## Switch colors with CSS variables

```ts
import { codeToHtml } from '@pierre/highlights';
import { cssVariables, pierreDark, toCSS } from '@pierre/highlights/themes';

const cssVariablePrefix = '--code-';
const html = new TextDecoder().decode(
  codeToHtml('const answer = 42;', {
    lang: 'ts',
    theme: cssVariables,
    cssVariablePrefix,
  })
);
const stylesheet = `.highlights { ${toCSS(pierreDark, { cssVariablePrefix })} }`;
```

Include the stylesheet with the markup. `toCSS(theme, options?)` accepts a
`Theme` and returns declarations without a selector. Apply them to the code
block or an ancestor. Keep its prefix and the highlighting prefix equal; both
default to `--hls-`. Changing declarations updates colors without tokenization.
This mode controls colors only and ignores theme font style and weight.

## Multiple themes

All highlighting and tokenization APIs accept a `themes` map. `defaultColor`
selects how it renders:

| Value            | Result                                                                                                                       |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| A theme key      | Applies that scheme inline and emits other schemes as custom properties; defaults to `light` and throws if the key is absent |
| `false`          | Emits all schemes as custom properties for CSS to select                                                                     |
| `'light-dark()'` | Requires `light` and `dark`; merges colors into CSS `light-dark()` values following the page's `color-scheme`                |

```ts
import { codeToHtml } from '@pierre/highlights';
import { pierreDark, pierreLight } from '@pierre/highlights/themes';

const html = new TextDecoder().decode(
  codeToHtml('const answer = 42;', {
    lang: 'ts',
    themes: { light: pierreLight, dark: pierreDark },
    defaultColor: false,
  })
);
```

Include CSS to select the emitted properties:

```css
.highlights {
  color: var(--hls-light);
  background-color: var(--hls-light-bg);
}

.highlights span {
  color: var(--hls-light);
  font-style: var(--hls-light-font-style, normal);
  font-weight: var(--hls-light-font-weight, normal);
}

@media (prefers-color-scheme: dark) {
  .highlights {
    color: var(--hls-dark);
    background-color: var(--hls-dark-bg);
  }

  .highlights span {
    color: var(--hls-dark);
    font-style: var(--hls-dark-font-style, normal);
    font-weight: var(--hls-dark-font-weight, normal);
  }
}
```

For a custom token renderer, apply each token's complete `htmlStyle` map to its
span. With `defaultColor: false`, apply `result.rootStyle` as the container's
inline style, then use equivalent CSS for that container. With an inline
default, the root style is `background-color:${result.bg};color:${result.fg}`;
these fields can include additional declarations. Preserve those declarations
instead of treating them as single CSS color values.
