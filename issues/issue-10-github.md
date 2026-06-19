# [BUG] Memory.chunkText cannot split unbroken content (base64, URLs, minified code, CJK) — produces oversized chunks the embedder rejects and an empty leading chunk

## Describe the Bug

`Memory.chunkText()` splits message content into chunks for embedding, but it can only break on whitespace (`text.split(/\s+/)`). Any single whitespace-free "word" longer than the chunk budget (`tokenSize * 4` chars, default 16,384) is emitted as **one oversized chunk** that the embedding provider then rejects.

This happens with real-world content:

- a base64 data URI / attachment payload serialized into message content,
- a long minified JS/JSON blob or a long URL with query params,
- spaceless CJK text — there is no whitespace to split on at all, so the **entire message** becomes one "word".

Embedding providers enforce a hard token limit per input (e.g. OpenAI `text-embedding-3-small`: 8,192 tokens). An oversized chunk makes `embedMany` reject, which fails `embedMessageContent` → `saveMessages` (semantic-recall indexing) or `recall` for that turn. The agent's memory pipeline errors on content the user legitimately pasted, with an opaque provider error that's hard to attribute back to chunking.

There is also an off-by-one at the boundary: when the **first** word already exceeds the budget, the code pushes the current (empty-string) chunk, so `chunks[0] === ''` and an empty string is sent to the embedder (some providers reject empty inputs).

`packages/memory/src/index.ts` (`chunkText`):

```ts
protected chunkText(text: string, tokenSize = 4096) {
  const charSize = tokenSize * CHARS_PER_TOKEN;
  const chunks: string[] = [];
  let currentChunk = '';
  const words = text.split(/\s+/);
  for (const word of words) {
    const wordWithSpace = currentChunk ? ' ' + word : word;
    if (currentChunk.length + wordWithSpace.length > charSize) {
      chunks.push(currentChunk);     // <-- pushes '' when the FIRST word is oversized
      currentChunk = word;           // <-- 'word' may itself exceed charSize; never split
    } else {
      currentChunk += wordWithSpace;
    }
  }
  if (currentChunk) chunks.push(currentChunk);
  return chunks;
}
```

Nothing ever splits inside a word, so `max(chunk.length)` is unbounded.

## Steps To Reproduce

1. Create a new project with `npx create-mastra@latest`.
2. Configure memory with semantic recall:
   ```ts
   new Memory({
     vector,
     embedder: openai.embedding('text-embedding-3-small'),
     options: { semanticRecall: true },
   });
   ```
3. Send a user message containing a single ~40,000-character unbroken string (base64 of a small image, or a minified JS bundle snippet).
4. On save, `embedMessageContent` → `embedMany` throws the provider's max-token error (`This model's maximum context length is 8192 tokens...`), failing the memory update for that turn.
5. Alternatively send ~20,000 chars of spaceless CJK text — same failure even though the text is normal prose.

## Link to Minimal Reproducible Example

Reproducible on a fresh `npx create-mastra@latest` project with a semantic-recall-enabled `Memory` instance and a single long whitespace-free message.

https://github.com/mastra-ai/mastra

## Expected Behavior

`chunkText` should guarantee every chunk is under the embedder's limit: hard-split oversized words by character count, and never emit an empty chunk.

## Environment Information

```block
<paste `npx envinfo --system --browsers --binaries --npmPackages --npmGlobalPackages` output>

Affected package: @mastra/memory (packages/memory/src/index.ts)
LLM Provider: any embedder with a hard per-input token limit (e.g. OpenAI text-embedding-3-small, 8192 tokens)
Browser (if applicable): N/A
```

## Verification

- [x] I have searched the existing issues to make sure this is not a duplicate
- [x] I have included sufficient information for the team to reproduce and understand the issue
