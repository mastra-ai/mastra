---
'@mastra/deployer': minor
---

Added an object form to `bundler.externals` so you can compose a preset with per-package overrides.

Previously `externals` was all-or-nothing: `true` externalized every non-workspace dependency, and an array only added names on top of bundling everything. Projects with a native `.node` addon in their dependency graph were forced onto `externals: true`, which then made it impossible to force-bundle a single broken package or to pin a dynamically imported one.

**Before**

```typescript
export const mastra = new Mastra({
  bundler: {
    externals: true,
  },
})
```

**After**

```typescript
export const mastra = new Mastra({
  bundler: {
    externals: {
      preset: 'all',
      exclude: ['broken-package'], // bundle this one anyway
      include: ['pg-native'], // externalize this one too
    },
  },
})
```

`exclude` only overrides what `preset` would externalize. It cannot remove Mastra's built-in runtime externals, and `include` wins when a package appears in both lists. The existing `boolean` and `string[]` forms are unchanged.
