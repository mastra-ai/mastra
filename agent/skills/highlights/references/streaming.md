# Streaming

`StreamTokenizer` extends `TransformStream<Uint8Array, ThemedToken[]>`. It takes
the [tokenization options](rendering.md#options-and-languages) and owns an
isolated WebAssembly instance. Use it for append-only input; use
[LiveTokenizer](live.md) when previously received text can change.

## Pipe a readable stream

Pass a UTF-8 byte stream through the tokenizer with `pipeThrough()`. It decodes
bytes internally, including characters split across chunks. Given an existing
`ReadableStream<Uint8Array>` named `responseBody`:

```ts
import { StreamTokenizer } from '@pierre/highlights';
import { pierreDark } from '@pierre/highlights/themes';

const lines = responseBody.pipeThrough(
  new StreamTokenizer({ lang: 'ts', theme: pierreDark })
);

for await (const tokens of lines) {
  console.log(tokens); // One ThemedToken[] per line
}
```

Closing the writable side emits the remaining lines and releases the instance.
Cancellation or abort discards buffered input and releases it. Let the stream
pipeline manage completion; use the synchronous methods below when manually
feeding strings or UTF-8 bytes.

## Push chunks synchronously

```ts
import { StreamTokenizer } from '@pierre/highlights';
import { pierreDark } from '@pierre/highlights/themes';

const stream = new StreamTokenizer({ lang: 'ts', theme: pierreDark });

try {
  console.log(stream.pushCode('const answer =')); // []: incomplete line
  const bytes = new TextEncoder().encode(' 42;\nconsole.log(answer);');
  console.log(stream.pushCode(bytes)); // First line
  console.log(stream.end()); // Remaining line; also disposes the instance
} finally {
  stream.dispose();
}
```

| Method                                  | Behavior                                                                                                                |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `pushCode(chunk: string \| Uint8Array)` | Accepts text or UTF-8 bytes; returns `ThemedToken[][]` for completed lines and buffers the unfinished line              |
| `end()`                                 | Finishes decoding and returns remaining lines, including an empty final line after a trailing terminator, then disposes |
| `dispose()`                             | Discards buffered input and releases the instance; safe to repeat                                                       |

Chunks can produce zero or more lines. Lines are emitted when `\n` arrives,
including in CRLF input, or at `end()`. Lexer state is retained across chunks.
Token offsets are UTF-16 indices from the start of the complete stream. Apply
the same token styles described in [Rendering](rendering.md#tokens).

Call `end()` once when input finishes. Calling `pushCode()` or `end()` after
disposal throws. Keep `dispose()` in cleanup paths for cancellation and errors.

UTF-8 characters can span consecutive byte chunks. Mixing strings and bytes
preserves chunk order: a nonempty string flushes incomplete UTF-8 as a
replacement character before appending the string. Empty chunks leave buffered
input intact.
