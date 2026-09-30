# Rendering

## HTML

```ts
import { codeToHtml } from '@pierre/highlights';
import { pierreDark } from '@pierre/highlights/themes';

const html = new TextDecoder().decode(
  codeToHtml('const answer = 42;', { lang: 'ts', theme: pierreDark })
);
```

`codeToHtml()` returns UTF-8 bytes for a
`<pre class="highlights"><code>…</code></pre>` fragment. Source text is
HTML-escaped and theme styles are applied inline. Decode the bytes immediately,
or call `.slice()` before retaining them across another highlighting or
tokenization call on the same highlighter. The top-level `codeToHtml()` and
`codeToTokens()` share one instance.

## Tokens

```ts
import { codeToTokens } from '@pierre/highlights';
import { pierreDark } from '@pierre/highlights/themes';

const result = codeToTokens('const answer = 42;\n', {
  lang: 'ts',
  theme: pierreDark,
});

console.log(result.tokens[0]); // ThemedToken[] for the first line
console.log(result.fg, result.bg); // Root foreground and background colors
```

`TokensResult.tokens` contains one `ThemedToken[]` per line. Line terminators
are excluded from content; a trailing line break adds an empty final line.
Offsets count UTF-16 code units from the start of the complete input.

| Token field            | Meaning                                                                       |
| ---------------------- | ----------------------------------------------------------------------------- |
| `content`, `offset`    | Text and its absolute UTF-16 start index                                      |
| `color`, `fontStyle`   | Single-theme color and Shiki-style font flags                                 |
| `htmlStyle`            | Multi-theme styles, including custom properties; apply the whole map          |
| `type`                 | `1` comment, `2` string, `3` regex, otherwise `0` or omitted                  |
| `bgColor`, `htmlAttrs` | Optional background and span attributes for renderer/transformer integrations |

Highlights emits italic (`1`) and bold (`2`) font flags. The type also supports
underline (`4`) and strikethrough (`8`) supplied by transformers. Use text nodes
or escape `content` in a custom HTML renderer. Apply root colors as well as
token styles. Token objects are Shiki-compatible; lexer boundaries and syntax
classifications can differ.

With multiple themes, `fg` and `bg` can contain CSS declaration lists, and
`defaultColor: false` supplies `rootStyle`. See [Themes](themes.md) for
rendering those styles. Equal runs can share an `htmlStyle` object; replace that
object when customizing one token.

## Options and languages

Both functions accept `string`, `Uint8Array`, or `ArrayBuffer` input; bytes are
UTF-8. Supply `lang` and exactly one of `theme` or `themes`.

| Option                  | Meaning                                                                                                                      |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `lang`                  | Built-in language name or alias, typed as `Lang`                                                                             |
| `theme`                 | One Zed `Theme` or `ThemeFamily` object                                                                                      |
| `themes`                | Non-empty map of named theme objects; see [Themes](themes.md)                                                                |
| `cssVariablePrefix`     | Prefix for CSS-variable colors and theme properties; default `--hls-`                                                        |
| `defaultColor`          | With `themes`, inline theme key (default `light`), `false`, or `'light-dark()'`                                              |
| `tokenizeMaxLineLength` | Tokenization only: lines at or above this UTF-16 length become one token without syntax styling; `0` or omission disables it |

The line-length limit reduces token objects, while the lexer still processes the
line to preserve subsequent state. It also applies to streaming and live
tokenization, but is not an HTML option.

Language names and aliases are case-insensitive. Unknown names throw
`RangeError`. Highlights performs no automatic language detection or filename
resolution. Validate external labels and choose an explicit fallback:

```ts
import { isSupportedLanguage } from '@pierre/highlights';

const requestedLanguage: string = 'typescript';
const lang = isSupportedLanguage(requestedLanguage)
  ? requestedLanguage
  : 'plain';
```

`isSupportedLanguage()` narrows a string to `Lang`. Plain text aliases include
`plain`, `text`, `plaintext`, and `txt`. Lexers are built in; custom TextMate
grammar registration belongs to the Shiki APIs in `@pierre/diffs`.

## Runtime and types

For embedders managing a compiled `WebAssembly.Module`, `init(module)` replaces
the shared highlighter; `createHighlighter(module)` returns an isolated
`Highlighter` without replacing it. Both are synchronous and require a module.
`Highlighter` exposes `codeToHtml()` and `codeToTokens()` with the signatures
above. Import the normal package entry for automatic initialization.

Core public types are `Highlighter`, `Lang`, `CodeToHtmlBaseOptions`,
`CodeToHtmlOptions`, `CodeToTokensBaseOptions`, `CodeToTokensOptions`,
`ThemeOptions`, `ThemedToken`, and `TokensResult`. Theme types are covered in
[Themes](themes.md); live types and `tokenNames` in
[Incremental editing](live.md).
