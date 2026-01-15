---
'@mastra/playground-ui': patch
'@internal/playground': patch
---

Replaced arbitrary Tailwind CSS values with standard utility classes for better consistency and maintainability.

- Changed arbitrary spacing values like `gap-[1rem]`, `p-[1.5rem]`, `px-[2rem]` to standard classes (`gap-4`, `p-6`, `px-8`)
- Updated z-index values from `z-[1]` and `z-[100]` to standard `z-10` and `z-50`
- Replaced arbitrary gap values like `gap-[6px]` with `gap-1.5`
- Updated duration values from `duration-[1s]` to `duration-1000`
