# Account menu composition

Use `AvatarRail` for organization shortcuts and `CompositeAvatar` for a person's avatar with an organization badge. The account-menu Storybook stories show both themes, keyboard navigation, many organizations, and the optional copy action.

## Compose the menu

The rail makes the popup a dialog containing a toolbar and named menus. Declare the trigger's popup type, label the content, and put action items inside `DropdownMenu.Group`. Pass `rail={null}` to keep the same layout without the rail column when only one organization applies.

```tsx
import { Avatar, CompositeAvatar } from '@mastra/playground-ui/components/Avatar'
import { AvatarRail } from '@mastra/playground-ui/components/AvatarRail'
import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu'

export function AccountMenu({ switchOrganization }: { switchOrganization: () => void }) {
  const identity = (
    <CompositeAvatar badge={<Avatar name="Acme" size="xs" />}>
      <Avatar name="Alex Morgan" size="md" />
    </CompositeAvatar>
  )

  return (
    <DropdownMenu>
      <DropdownMenu.IdentityTrigger avatar={identity} aria-haspopup="dialog" description="alex@example.com">
        Alex Morgan
      </DropdownMenu.IdentityTrigger>
      <DropdownMenu.Content
        aria-label="Account and organizations"
        rail={
          <AvatarRail aria-label="Organizations">
            <AvatarRail.Item aria-label="Acme" current onClick={switchOrganization}>
              <Avatar name="Acme" size="rail" />
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

Use the existing `md` avatar for the profile and `xs` for its badge. The `rail` avatar size uses the existing medium-control token. Rail items keep a stable circular target and a separate current-organization ring. Popup surfaces, borders, hover and focus fills, focus outlines, and text colors use semantic design-system tokens.
