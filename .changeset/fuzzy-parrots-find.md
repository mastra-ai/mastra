---
'@mastra/react': patch
---

**Fixed** React UIs getting `401` from Mastra after a successful cookie login when the app and API run on different hosts or ports (for example Mastra Studio against a custom server). API calls from `MastraReactProvider` now include session cookies by default ([#14770](https://github.com/mastra-ai/mastra/issues/14770)).

**Added** optional `credentials` prop when you want tighter control, for example same-origin-only requests:

```tsx
<MastraReactProvider baseUrl="http://localhost:4000" credentials="same-origin">
  {children}
</MastraReactProvider>
```

**Added** `MastraClientCredentials` and `MastraClientProviderProps` type exports.
