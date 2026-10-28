---
'@mastra/playground-ui': patch
---

Added an `inline` appearance to `Activity` and a `flush` option to `ActivityContent`, for activity lines that sit inside prose. An inline line drops the hover surface and inset, and its text brightens on hover instead. A flush body drops the rail and indent so it lines up with the surrounding text. The default `row` appearance is unchanged.

```tsx
<Activity appearance="inline">
  <ActivityTrigger>
    <ActivityHeadline icon={<FileText />} label="Read files" />
  </ActivityTrigger>
  <ActivityContent flush>{thoughts}</ActivityContent>
</Activity>
```
