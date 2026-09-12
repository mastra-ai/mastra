# Settings

Use named exports from `@mastra/playground-ui/new/settings`. This is the canonical settings API; it does not attach subcomponents to a namespace object.

```tsx
import {
  SettingsContainer,
  SettingsDescription,
  SettingsGroup,
  SettingsHeader,
  SettingsRow,
  SettingsTitle,
} from '@mastra/playground-ui/new/settings';

<SettingsGroup>
  <SettingsHeader>
    <SettingsTitle>Mastra Connection</SettingsTitle>
    <SettingsDescription>Configure the connection used by Studio.</SettingsDescription>
  </SettingsHeader>
  <SettingsContainer>
    <SettingsRow label="API prefix" htmlFor="api-prefix">
      <input id="api-prefix" name="apiPrefix" defaultValue="/api" />
    </SettingsRow>
  </SettingsContainer>
</SettingsGroup>;
```

`SettingsGroup` connects its section to `SettingsTitle` for an accessible name. Use one title per group. `SettingsHeader` accepts an optional `action`; `SettingsTitle` accepts an optional `accessory`, such as a scope badge. `SettingsContainer` supplies the card and dividers between its children. Each `SettingsRow` contains one setting and its control; link an input with `htmlFor` and its `id`. Use `viewOnly` for inherited values and `tone="destructive"` for destructive actions. Persistence, permissions, and scope selection remain in the consuming application.

The default presentation matches Factory: rows stack below the `lg` breakpoint. `SettingsLayout` is re-exported from the existing layout component for page-level width, spacing, and optional page headers.

## Migration

| Older API                                                 | Replacement                                                               |
| --------------------------------------------------------- | ------------------------------------------------------------------------- |
| `components/SettingsRow` with `variant="factory"`         | `SettingsRow`; omit the variant                                           |
| Factory's `SettingsCard`                                  | `SettingsContainer`                                                       |
| Factory's subsection presentation                         | `SettingsGroup`, `SettingsHeader`, `SettingsTitle`, `SettingsDescription` |
| `Section.Row` on settings pages                           | `SettingsRow`                                                             |
| `Section.ViewOnlyRow`                                     | `SettingsRow viewOnly`                                                    |
| `Section.DestructiveRow`                                  | `SettingsRow tone="destructive"`                                          |
| `Section.Content` and explicit dividers on settings pages | `SettingsContainer` with rows as direct children                          |

The published `components/SettingsRow` and `Section` APIs still work through shared row/container implementations. Their legacy typography, layout variants, and responsive behavior are preserved for consumers that have not migrated. A legacy default row switches to a horizontal layout at `sm`; the new Factory row switches at `lg`. `Section` also remains available for generic, non-settings content. Its settings-specific header variants remain compatibility styles until their consumers migrate.
