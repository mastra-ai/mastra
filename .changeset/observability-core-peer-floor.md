---
'@mastra/observability': patch
---

Fixed the declared `@mastra/core` requirement, which was low enough to let a broken combination install cleanly and then crash on startup.

Since 1.17.3 this package has imported `resolveExportedSpanId` from `@mastra/core/observability`, an export that only exists in `@mastra/core` 1.63.0 and later. The peer range still allowed anything from 1.16.0 up, so a project holding an older core installed with no warning and then failed the moment Node linked the module graph:

```
SyntaxError: The requested module '@mastra/core/observability'
does not provide an export named 'resolveExportedSpanId'
```

Because the import is static, this happens before any application code runs, and it usually surfaces first in a deploy rather than locally.

The floor now matches what the code actually calls:

```diff
  "peerDependencies": {
-   "@mastra/core": ">=1.16.0-0 <2.0.0-0"
+   "@mastra/core": ">=1.63.0-0 <2.0.0-0"
  }
```

Projects on an affected combination now get a resolvable install-time error naming the real requirement instead of a startup crash. If you hit it, upgrade `@mastra/core` to 1.63.0 or later.
