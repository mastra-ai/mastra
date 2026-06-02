---
'@mastra/core': patch
---

Add `updateThread` as an abstract method on the `MastraMemory` base class and implement it in `MockMemory`. Previously the method existed only on the concrete `Memory` subclass, so calling `updateThread` on a variable typed as `MastraMemory` (or any other `MastraMemory` subclass) produced a TypeScript error. Callers can now rename or re-title threads through the base class API without casting.
