---
'@mastra/playground-ui': minor
---

Streamed markdown now renders block by block. A growing reply re-parses only the block still being written instead of the whole message on every chunk, so a long reply no longer costs more per chunk as it gets longer, and a reply that finishes streaming keeps every element it already put on screen instead of remounting.

Half-written markdown also renders as what it is about to become: `**bold` reads as bold while its closing marker is still in flight, and a link shows its text until the URL lands, instead of flashing raw syntax on screen.

One caveat: splitting a text into blocks is deliberately conservative rather than a second full parse. Anything it cannot decide — an unclosed fence, an indented continuation, a link reference or footnote definition — is kept whole, so those replies render exactly as before and simply do not get the speedup.
