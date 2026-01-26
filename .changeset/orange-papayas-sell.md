---
'@mastra/react': patch
---

Added `apiPrefix` prop to `MastraClientProvider` for connecting to servers with custom API route prefixes.

```tsx
<MastraClientProvider baseUrl="http://localhost:3000" apiPrefix="/mastra">
  {children}
</MastraClientProvider>
```
