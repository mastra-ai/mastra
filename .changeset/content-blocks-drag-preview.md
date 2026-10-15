---
'@mastra/playground-ui': patch
---

Added an optional `renderDragPreview` prop to `ContentBlocks`. When set, the dragged item is rendered on `document.body`, so a list inside a menu or popover no longer shows the dragged item far from the pointer.

```tsx
<ContentBlocks items={groups} onChange={setGroups} renderDragPreview={group => <GroupRow group={group} />}>
  {groups.map((group, index) => (
    <ContentBlock key={group.id} draggableId={group.id} index={index}>
      {dragHandleProps => <GroupRow group={group} dragHandleProps={dragHandleProps} />}
    </ContentBlock>
  ))}
</ContentBlocks>
```
