---
'@mastra/core': patch
---

Added an `outputEncoding` option to `LocalSandbox` so command output in non-UTF-8 encodings is decoded correctly. On Windows systems using a legacy code page, such as Chinese (GBK / code page 936), native commands previously returned garbled text.

```ts
const sandbox = new LocalSandbox({ outputEncoding: 'gbk' });
```

UTF-8 remains the default. Fixes #25249.
