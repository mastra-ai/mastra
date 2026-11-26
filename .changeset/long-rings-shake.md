---
'@mastra/playground-ui': patch
---

Loading placeholders in the Factory board, sidebar, session transcript, settings and Knowledge components now match the size and layout of the content they stand in for, so less of the page moves when the data arrives.

`SettingsSkeleton` takes an optional `placeholder` that it repeats for each row, so a section can show rows shaped like its real ones:

```tsx
<SettingsSkeleton
  label="Loading versions"
  placeholder={<SettingsItem title={<SkeletonText line="text-label" className="w-40" />} />}
/>
```
