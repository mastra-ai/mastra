---
'@mastra/playground-ui': minor
---

Added AvatarRail with keyboard navigation, CompositeAvatar with an overlay badge, and an identity trigger and rail slot for account menus.

```tsx
import { Avatar, CompositeAvatar } from '@mastra/playground-ui/components/Avatar';
import { AvatarRail } from '@mastra/playground-ui/components/AvatarRail';

<CompositeAvatar badge={<Avatar name="Acme" size="xs" />}>
  <Avatar name="Alex Morgan" size="sm" />
</CompositeAvatar>

<AvatarRail aria-label="Organizations">
  <AvatarRail.Item aria-label="Acme" current onClick={switchToAcme}>
    <Avatar name="Acme" size="rail" />
  </AvatarRail.Item>
</AvatarRail>
```

`DropdownMenu.IdentityTrigger` takes an `avatar` slot and an optional `description`.
A `rail` on `DropdownMenu.Content` gives the popup dialog semantics; set the
trigger's `aria-haspopup="dialog"`, name the content, and group action items with
`DropdownMenu.Group role="menu"`. Left and right arrow keys move between the rail
and actions. The toolbar's up and down arrows move focus without selecting an
organization; Enter or Space activates it.
