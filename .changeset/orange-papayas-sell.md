---
'@mastra/react': minor
---

Added `apiPrefix` prop to `MastraClientProvider` for connecting to servers with custom API route prefixes (defaults to `/api`).

**Default usage (no change required):**

```tsx
<MastraClientProvider baseUrl="http://localhost:3000">
  {children}
</MastraClientProvider>
```

**Custom prefix usage:**

```tsx
<MastraClientProvider baseUrl="http://localhost:3000" apiPrefix="/mastra">
  {children}
</MastraClientProvider>
```

See #12261 for more details.
