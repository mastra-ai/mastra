### 11.1 Code layout

```
packages/core/src/harness/
├── index.ts                 # subpath: '@mastra/core/harness'
│                            # exports `Harness` = the existing implementation
├── harness.ts               # the existing implementation, unchanged
├── tools.ts                 # ... existing files, unchanged
├── display-state-scheduler.ts
├── ...
└── v1/
    ├── index.ts             # subpath: '@mastra/core/harness/v1'
    │                        # exports `Harness` = the new implementation
    ├── harness.ts           # new `Harness` class (the registry/factory side)
    ├── session.ts           # `Session` class
    ├── shared.ts            # re-exports stable types from ../ when shape matches
    └── ...
```

Stable interfaces (`HarnessMessage`, `HarnessMode`, `HarnessStorage`, workspace types) are re-exported from both subpaths and back the same underlying definitions wherever shapes align. When the v1 API needs a shape change (for example, `HarnessRequestContext` gaining required fields per §6.1), the new shape lives in `v1/` and the old shape stays under the legacy subpath untouched. There is no shared base class and no runtime shim.
