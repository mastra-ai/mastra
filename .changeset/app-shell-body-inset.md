---
'@mastra/playground-ui': patch
---

`AppShell` now insets its body (`p-1.5 lg:p-2`, dropping the left inset at `lg` when a `sidebar` is passed) so the frame rendered inside it no longer needs its own margins. Consumers that put `m-*` classes on their own frame should remove them. `PageShell` body padding is now `p-4` (was `p-4 px-6`) to match the rest of the page layouts.
