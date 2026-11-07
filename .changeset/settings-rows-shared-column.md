---
'@mastra/playground-ui': minor
---

One settings layout for Studio, Factory and Platform, from `@mastra/playground-ui/new/settings`:

- `SettingsLayout` is the page: a centered 640px column with the title above its sections, 28px apart. Pass `header` for an app's own header.
- `SettingsTitle` sits dimmed above each card. `info` shows a section description as a tooltip on the title.
- `SettingsContainer` is a borderless card that owns its rows' spacing (14px padding, hairlines between rows that stop at it), so rows carry no padding of their own. Rows with nothing in them take no space.
- `SettingsRow` keeps the label and description on the left and the control on the right. Text fields share one 13.75rem width; selects hug their value up to that width; switches and buttons keep their size. `controlPlacement="below"` puts a control under its label at full width.
- Lists: `SettingsListHeader` puts a count and the list's action at the top of its card, `SettingsEmptyRow` holds the empty text and that same action in one row, and `SettingsItem` (with `SettingsItemIcon` for logos and icons, the same size as `Avatar size="md"`) is one thing in a list. `SettingsNoticeRow` keeps a list's errors inside its card.
- `CopyInput` (`@mastra/playground-ui/components/CopyInput`) shows a read-only value, like an ID, with a copy button.

Breaking changes in `@mastra/playground-ui/new/settings`:

- `SettingsLayout` no longer takes `description`, `inset` or `variant`. Put a page description in the first section, and pass `header` for a header of your own instead of `variant="header"`.
- `SettingsContainer` no longer takes `variant`, and `SettingsContainerVariant` is no longer exported. Drop `variant="inset"`; every settings card has the same look.

Input, InputGroup and select values now use the regular-weight `text-body-sm`, like Textarea.

```tsx
<SettingsLayout title="General">
  <SettingsGroup>
    <SettingsTitle>Accounts</SettingsTitle>
    <SettingsContainer>
      {accounts.length === 0 ? (
        <SettingsEmptyRow action={addButton}>No accounts connected</SettingsEmptyRow>
      ) : (
        <>
          <SettingsListHeader action={addButton}>{accounts.length} accounts</SettingsListHeader>
          {accounts.map(account => (
            <SettingsItem key={account.id} media={<SettingsItemIcon>{account.icon}</SettingsItemIcon>} title={account.name} />
          ))}
        </>
      )}
    </SettingsContainer>
  </SettingsGroup>
</SettingsLayout>
```
