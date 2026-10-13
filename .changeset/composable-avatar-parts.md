---
'@mastra/playground-ui': minor
---

Added composable parts to `Avatar`: `Avatar.Image`, `Avatar.Fallback`, `Avatar.Badge`, `Avatar.Group`, and `Avatar.GroupCount`. Added `xs` and `control` sizes. Existing `<Avatar name="…" />` usage is unchanged.

```tsx
import { Avatar } from '@mastra/playground-ui/components/Avatar';

<Avatar size="md">
  <Avatar.Image src={user.avatarUrl} alt={user.name} />
  <Avatar.Fallback>AM</Avatar.Fallback>
  <Avatar.Badge>
    <Avatar name={organization.name} src={organization.logo} />
  </Avatar.Badge>
</Avatar>

<Avatar.Group size="sm">
  <Avatar name="Jane Smith" src={jane} />
  <Avatar name="Sam Lee" src={sam} />
  <Avatar.GroupCount>+3</Avatar.GroupCount>
</Avatar.Group>
```

`Avatar.Badge` takes a `tone` (`neutral`, `success`, `warning`, `destructive`, `info`) for a status dot, or any child such as an icon or a small organization avatar. Avatars inside a group or badge take their size from it.
