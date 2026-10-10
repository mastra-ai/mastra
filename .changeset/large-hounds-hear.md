---
'@mastra/playground-ui': minor
---

Added AvatarRail with keyboard navigation, CompositeAvatar with an overlay badge, and an identity trigger and account layout for DropdownMenu.

`CompositeAvatar` shows a person's avatar with their current organization's logo as a small badge, for the account menu trigger. `AvatarRail` lists organizations to switch between.

```tsx
import { Avatar, CompositeAvatar } from '@mastra/playground-ui/components/Avatar';
import { AvatarRail } from '@mastra/playground-ui/components/AvatarRail';

<CompositeAvatar badge={<Avatar name="Acme" size="xs" />}>
  <Avatar name="Alex Morgan" size="md" />
</CompositeAvatar>

<AvatarRail aria-label="Organizations">
  <AvatarRail.Item aria-label="Acme" current onClick={switchToAcme}>
    <Avatar name="Acme" size="control" />
  </AvatarRail.Item>
</AvatarRail>
```

`DropdownMenu.IdentityTrigger` takes an `avatar` slot and an optional `description`.
`DropdownMenu.Content` with `layout="account"`:

- Renders a dialog with the optional `rail` beside the actions. Leave out `rail` for a single organization.
- Set `aria-haspopup="dialog"` on the trigger, name the content, and wrap actions in `DropdownMenu.Group role="menu"`.
- Left and right arrows move between the rail and actions. Up and down move within the rail without switching; Enter or Space switches.
