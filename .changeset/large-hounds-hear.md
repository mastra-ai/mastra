---
'@mastra/playground-ui': minor
---

Added AvatarRail with keyboard navigation, and an identity trigger and account layout for DropdownMenu.

`AvatarRail` lists organizations to switch between. Pair it with `Avatar.Badge` to show the current organization's logo on the account menu trigger.

```tsx
import { Avatar } from '@mastra/playground-ui/components/Avatar';
import { AvatarRail } from '@mastra/playground-ui/components/AvatarRail';

<Avatar size="md">
  <Avatar.Image src={user.avatarUrl} alt="Alex Morgan" />
  <Avatar.Fallback>AM</Avatar.Fallback>
  <Avatar.Badge>
    <Avatar name="Acme" src={acmeLogo} />
  </Avatar.Badge>
</Avatar>

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
