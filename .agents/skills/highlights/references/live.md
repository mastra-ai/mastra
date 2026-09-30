# Incremental editing

`LiveTokenizer` owns a document and an isolated WebAssembly instance. It
re-tokenizes changed lines and following lines until the lexer state converges
with the retained state. Constructor options extend the
[tokenization options](rendering.md#options-and-languages) with `code` (default
empty), `renderRange`, and `onDeferTokenize`.

## Apply edits

```ts
import { LiveTokenizer } from '@pierre/highlights';
import { pierreDark } from '@pierre/highlights/themes';

const live = new LiveTokenizer({
  code: 'const answer = 41;\nconsole.log(answer);',
  lang: 'ts',
  theme: pierreDark,
});

try {
  const update = live.applyEdits([
    {
      range: {
        start: { line: 0, character: 15 },
        end: { line: 0, character: 17 },
      },
      newText: '42',
    },
  ]);

  console.log(live.getLineText(0)); // const answer = 42;
  for (const change of update.lineChanges) {
    for (let line = change.newStartLine; line < change.newEndLine; line++) {
      console.log(line, live.getLineTokens(line));
    }
  }
} finally {
  live.dispose();
}
```

Every edit range uses zero-based lines and UTF-16 character positions in the
document before the batch. The end position is exclusive. Overlapping ranges are
rejected before mutation. `reset(code, options?)` replaces the whole text while
retaining language and theme options; recreate the tokenizer to change those
options.

Without `renderRange`, updates finish synchronously and `update.lines` is empty.
Use `lineChanges` and `getLineTokens()` to refresh a renderer. Each
`LiveLineChange` maps `[oldStartLine, oldEndLine)` to
`[newStartLine, newEndLine)`; also remove deleted rows when reconciling a view.
`LiveTokenizerUpdate` includes `revision`, `previousLineCount`, and `lineCount`.

`getLineTokens(line)` returns `{ tokens, bracketIgnoredRanges }`. Its token
offsets are relative to that line. `bracketIgnoredRanges` contains end-exclusive
UTF-16 column pairs for strings, comments, and regexes that bracket matching
should skip.

## Prioritize a viewport

`renderRange: [startLine, endLine]` uses post-edit line numbers and excludes
`endLine`. Pass it on each update that should prioritize a viewport. Dirty lines
before the viewport must also be processed to establish lexer state; the
remaining work runs in background slices.

```ts
import { LiveTokenizer } from '@pierre/highlights';
import { pierreDark } from '@pierre/highlights/themes';

const live = new LiveTokenizer({
  code: 'const answer = 41;\nconsole.log(answer);',
  lang: 'ts',
  theme: pierreDark,
  renderRange: [0, 1],
  onDeferTokenize(lines) {
    // This callback can run before the constructor returns.
    for (const [line, tokens] of lines) console.log(line, tokens);
  },
});

try {
  console.log(live.getLineTokens(0)); // Read the initial viewport after construction.
  const update = live.applyEdits(
    [
      {
        range: {
          start: { line: 0, character: 15 },
          end: { line: 0, character: 17 },
        },
        newText: '42',
      },
    ],
    { renderRange: [0, 1] }
  );
  for (const [line, tokens] of update.lines) console.log(line, tokens);

  live.flush(); // Finish pending work before reading the complete document's tokens.
} finally {
  live.dispose();
}
```

`update.lines` contains re-tokenized lines inside the range, not the entire
viewport. Finished lines outside it arrive through `onDeferTokenize`, which can
run synchronously during construction or an update. Keep the callback
independent of the variable receiving the new instance. Schedule further edits
after the current update; calling `applyEdits()` or `reset()` inside its
synchronous callback throws.

Both maps contain `HighlightedToken[]`: tuples of
`[character, foregroundColor, text]` using the first resolved theme. Read
`getLineTokens()` when font styles or multi-theme `htmlStyle` maps are needed.
While `pendingTokenization` is true, unreached lines can retain old tokens and
new lines can have foreground-only tokens. Call `flush()` before reads that
require fully current tokens.

## Document and lifecycle API

| Member                                         | Purpose                                                                      |
| ---------------------------------------------- | ---------------------------------------------------------------------------- |
| `revision`, `lineCount`, `pendingTokenization` | Read document revision, line count, and pending work                         |
| `applyEdits(edits, options?)`                  | Apply a batch and return `LiveTokenizerUpdate`                               |
| `reset(code, options?)`                        | Replace text and return `LiveTokenizerUpdate`                                |
| `getLineLength(line)`, `getLineText(line)`     | Read UTF-16 length or text excluding the terminator                          |
| `getText()`                                    | Read all text, preserving LF, CRLF, and lone CR                              |
| `getLineTokens(line)`                          | Read themed tokens and bracket-ignored ranges                                |
| `getLineRecords(line)`                         | Read packed raw token records                                                |
| `flush(endLine?)`                              | Finish pending work before an exclusive line bound, or all work when omitted |
| `pause()`, `resume()`                          | Suspend or resume background tokenization                                    |
| `dispose()`                                    | Release the instance and cancel deferred work; safe to repeat                |

`flush()`, `reset()`, and `applyEdits()` (even a no-op batch) resume paused
work. After disposal, other methods and state getters throw. Keep one tokenizer
for the document's lifetime and dispose it when the editor unmounts or closes.

## Packed records

`getLineRecords()` returns `LiveTokenRecords` with `revision`, `format`, and
`data: Uint32Array`. Starts are implicit: zero for the first token, then the
previous token's end. End positions are UTF-16 columns within the line.

| Format     | Encoding                                                             |
| ---------- | -------------------------------------------------------------------- |
| `packed24` | One word per token: `tokenId = word >>> 24`, `end = word & 0xffffff` |
| `wide32`   | Pairs of `[endUtf16, tokenId]` for lines exceeding the 24-bit range  |

Import `tokenNames` from `@pierre/highlights` to map IDs to syntax scope names.
Views are invalidated by successful edits, resets, deferred tokenization slices,
and disposal. Copy `records.data.slice()` before retaining data across those
operations. Deferred work can invalidate data without changing the document
revision.

The root entry exports `HighlightedToken`, `LiveLineChange`, `LivePosition`,
`LiveTextEdit`, `LiveTokenizerOptions`, `LiveTokenizerUpdate`,
`LiveTokenRecords`, and `LiveUpdateOptions`. Use `LivePosition` and
`LiveTextEdit` for the public position and edit types.
