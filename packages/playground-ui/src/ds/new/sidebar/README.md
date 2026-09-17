# SidebarNew

`SidebarNew` is a composable product-navigation shell. Products choose their header, navigation, and footer content; the root owns responsive layout, collapse state, and mobile presentation.

## Header choice

Use `SidebarNew.Header` when the product header needs several contextual controls, such as an environment selector. Place `SidebarNew.Trigger` in that header when collapse belongs with those controls.

Use `SidebarNew.CommandHeader` for a compact product identity with global search. Move `SidebarNew.Trigger` into `SidebarNew.FooterMeta` so collapse does not compete with the brand and search.

```tsx
<SidebarNew.CommandHeader>
  <SidebarNew.Brand logo={<ProductLogo />} title="Mastra" />
  <SidebarNew.SearchTrigger aria-label="Search" shortcut="⌘ K" onClick={openSearch}>
    <Search />
  </SidebarNew.SearchTrigger>
</SidebarNew.CommandHeader>
```

`CommandHeader` is optional. Do not add an empty command header to products without global search.

```tsx
<SidebarNew.Header>
  <SidebarNew.Brand logo={<ProductLogo />} title="Mastra Platform" />
  <EnvironmentSwitcher />
  <SidebarNew.Trigger />
</SidebarNew.Header>
```

Do not add `search`, `version`, or product-name props to `SidebarNew`. These values are product content and belong in composed children.

## Search trigger

`SidebarNew.SearchTrigger` is a button for opening the product's existing search or command interface. It does not own dialog state or search results.

- Supply an accessible name with `aria-label` when the child is icon-only.
- Use `shortcut` only when the application registers that shortcut.
- Omit the trigger when the product has no global search.

```tsx
<SidebarNew.SearchTrigger aria-label="Search" shortcut="⌘ K" onClick={openSearch}>
  <Search />
</SidebarNew.SearchTrigger>
```

Do not render a shortcut hint that has no matching keyboard handler.

## Footer metadata

Use `SidebarNew.FooterMeta` for deployment metadata such as an OSS version, build identifier, region, or release channel. The content is hidden when the sidebar is collapsed; the `action` remains available.

```tsx
<SidebarNew.Footer>
  <SidebarNew.FooterMeta action={<SidebarNew.Trigger />}>Mastra v0.24.6</SidebarNew.FooterMeta>
  <AccountMenu />
</SidebarNew.Footer>
```

Hosted products that do not expose deployment metadata may omit the content and keep only the action. Self-hosted products should show the running version rather than a package's latest available version.

## Semantic colors

Sidebar components use semantic roles from `theme.css`. Component classes may use:

- `text-foreground` for primary text
- `text-muted-foreground` for metadata and secondary controls
- `bg-sidebar-nav-hover` for navigation and command hover states
- `border-sidebar-divider` and `bg-sidebar-divider` for structural separators
- `bg-surface-overlay-soft` for quiet control surfaces

Never introduce raw `gray-*`, `neutral-*`, hex, RGB, HSL, or direct `var(--gray-alpha-*)` values for visible foreground, background, or border colors in SidebarNew components. Theme differences belong in semantic token definitions, not component class names.
