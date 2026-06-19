# fix(memory): hard-split oversized unbroken content in chunkText

> Branch: `fix/memory-chunktext-oversized-unbroken-content` → `main`
> Paste the sections below into the GitHub PR body (they follow `.github/PULL_REQUEST_TEMPLATE.md`).

## Description

`Memory.chunkText()` splits message content into chunks for embedding but could only break on whitespace (`text.split(/\s+/)`). Any single whitespace-free "word" longer than the chunk budget (`tokenSize * 4` chars) was emitted as one oversized chunk, which the embedding provider then rejects with a "maximum context length" error — failing `embedMessageContent` and, with it, semantic-recall persistence (`saveMessages`) or `recall` for that turn.

This is a common real-world input, not an exotic one:

- a base64 data URI / attachment payload serialized into message content,
- a long minified JS/JSON blob or a long URL with query params,
- spaceless CJK text, where the whole message is a single "word" with nothing to split on.

There was also an off-by-one: when the **first** word already exceeded the budget, the code pushed the current empty-string chunk, so `chunks[0] === ''` and an empty input was sent to the embedder (which some providers also reject).

### Changes

- `chunkText` now hard-splits any single word longer than `charSize` into `charSize` slices, so every chunk is guaranteed to stay under the budget regardless of whitespace.
- Accumulated words are flushed into their own chunk before an oversized word is split, so leading content is never lost or merged into the blob.
- The empty leading chunk is no longer emitted: the `chunks.push(currentChunk)` in the size-overflow branch is guarded with `if (currentChunk)`.
- No change to behavior for normal whitespace-separated prose: those inputs still chunk exactly as before.

**Files changed**
- `packages/memory/src/index.ts` — hard-split oversized words, guard empty leading chunk
- `packages/memory/src/chunk-text.test.ts` — new unit tests for the oversized/empty-chunk cases
- `.changeset/spicy-memories-chunk.md` — patch changeset

## Related issue(s)

<!-- File the issue from issues/issue-10-github.md and link it here, e.g. Fixes #XXXX -->

_See `issues/issue-10-github.md` for the bug report to file and link before submitting._

## Type of change

- [x] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to change)
- [ ] Documentation update
- [ ] Code refactoring
- [ ] Performance improvement
- [ ] Test update

## How it was tested

- **New unit tests** (`packages/memory/src/chunk-text.test.ts`) — fail on the unpatched code, pass with the fix:
  - normal prose still splits on whitespace into non-empty chunks under the budget,
  - a single ~100k-char unbroken string (base64/minified blob) splits into `ceil(len/charSize)` chunks, each non-empty and ≤ budget, with all characters preserved in order,
  - an oversized first word no longer produces an empty leading chunk,
  - ~20k chars of spaceless CJK split correctly,
  - accumulated short words are flushed into their own chunk before an oversized word is split.
- **No regressions**: existing `packages/memory/src/embedding-cache.test.ts` still passes (the cache test asserts `chunks` for normal content is unchanged).
- `tsc --noEmit` on `@mastra/memory` is clean.

## Checklist

- [ ] I have linked the related issue(s) in the description above _(pending — file the issue first)_
- [x] I have made corresponding changes to the documentation (if applicable) _(none needed; internal helper, behavior now matches the documented embedding contract)_
- [x] I have added tests that prove my fix is effective
- [ ] I have addressed all Coderabbit comments on this PR _(after PR is opened)_

## Diff summary

```diff
   for (const word of words) {
+    // A single word can be longer than the chunk budget (base64 data URI,
+    // minified JS/JSON blob, long URL, or spaceless CJK text). The whitespace
+    // split can't break these, so hard-split the oversized word by character
+    // count to keep every chunk under the embedder's token limit.
+    if (word.length > charSize) {
+      if (currentChunk) {
+        chunks.push(currentChunk);
+        currentChunk = '';
+      }
+      for (let i = 0; i < word.length; i += charSize) {
+        chunks.push(word.slice(i, i + charSize));
+      }
+      continue;
+    }
+
     const wordWithSpace = currentChunk ? ' ' + word : word;
     if (currentChunk.length + wordWithSpace.length > charSize) {
-      chunks.push(currentChunk);
+      // Guard against an empty leading chunk when the first word fills the budget.
+      if (currentChunk) {
+        chunks.push(currentChunk);
+      }
       currentChunk = word;
     } else {
       currentChunk += wordWithSpace;
     }
   }
```

🤖 Generated with [Claude Code](https://claude.com/claude-code)
