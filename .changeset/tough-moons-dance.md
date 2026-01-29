---
'@mastra/core': patch
---

Fixed repeated build failures caused by stale global cache (~/.cache/mastra/) containing invalid TypeScript in provider-types.generated.d.ts. Provider names starting with digits (e.g. 302ai) are now properly quoted, and the global cache sync validates .d.ts files before copying to prevent corrupted files from overwriting correct ones.
