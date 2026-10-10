# Account menu composition

Use `AvatarRail` for organization shortcuts and `Avatar.Badge` to put an organization's logo on a person's avatar. The account-menu Storybook stories show both themes, keyboard navigation, many organizations, and the optional copy action.

## Compose the menu

`layout="account"` makes the popup a dialog containing a toolbar and named menus. Declare the trigger's popup type, label the content, and put action items inside `DropdownMenu.Group`. Leave out `rail` to keep the same layout without the rail column when only one organization applies.

```tsx
import { Avatar } from '@mastra/playground-ui/components/Avatar'
import { AvatarRail } from '@mastra/playground-ui/components/AvatarRail'
import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu'

export function AccountMenu({ switchOrganization }: { switchOrganization: () => void }) {
  const identity = (
    <Avatar size="md">
      <Avatar.Fallback>AM</Avatar.Fallback>
      <Avatar.Badge>
        <Avatar name="Acme" />
      </Avatar.Badge>
    </Avatar>
  )

  return (
    <DropdownMenu>
      <DropdownMenu.IdentityTrigger avatar={identity} aria-haspopup="dialog" description="alex@example.com">
        Alex Morgan
      </DropdownMenu.IdentityTrigger>
      <DropdownMenu.Content
        aria-label="Account and organizations"
        layout="account"
        rail={
          <AvatarRail aria-label="Organizations">
            <AvatarRail.Item aria-label="Acme" current onClick={switchOrganization}>
              <Avatar name="Acme" size="control" />
            </AvatarRail.Item>
          </AvatarRail>
        }
      >
        <DropdownMenu.Group role="menu" aria-label="Account actions">
          <DropdownMenu.Item>Account settings</DropdownMenu.Item>
        </DropdownMenu.Group>
      </DropdownMenu.Content>
    </DropdownMenu>
  )
}
```

## Keyboard behavior

Up and down arrows move focus through enabled rail items without selecting an organization. Enter or Space activates an item. Right Arrow moves to the actions; Left Arrow returns to the current organization or the first enabled shortcut. Escape closes the popup and restores trigger focus.

## Sizes and colors

Use the `md` avatar for the profile. An avatar inside `Avatar.Badge` takes the `xs` size and drops its own stroke. The rail uses the `control` avatar size. Rail items keep a stable circular target and a separate current-organization ring. Popup surfaces, borders, hover and focus fills, focus outlines, and text colors use semantic design-system tokens.
