# @mastra/playground-ui

Reusable React components, hooks, domains, and design tokens used by Mastra Studio. It provides the UI building blocks for logs, memory, metrics, traces, and agent management.

## Installation

```bash
npm install @mastra/playground-ui
```

## Usage

Import the package styles once in your React application.

```tsx
import '@mastra/playground-ui/style.css';
import { Button } from '@mastra/playground-ui/components/Button';

export function SaveButton() {
  return <Button>Save</Button>;
}
```

### Opt-in semantic theme

`new-theme.css` provides scoped semantic color tokens. Import it and apply `new-theme` to the root of the content using those tokens. Keep importing `style.css` once in the app for the compiled utilities.

```tsx
import '@mastra/playground-ui/new-theme.css';

export function SummaryCard() {
  return <div className="new-theme bg-card text-foreground">Summary</div>;
}
```

The scope limits token defaults, not utility selectors. Classes such as `bg-card` remain global and share the host app's token contract. Audit existing uses before adopting these utilities; a previously ineffective class can start affecting the cascade.

Semantic values follow the existing `html.light` mode; dark mode is the default. Override `--card`, `--foreground`, or another semantic variable on the themed element to customize it.

Portalled content using semantic colors also needs `new-theme` on its portal root, since it renders outside the themed DOM subtree. Apply custom overrides to that root too; values inherited from the trigger's ancestors do not cross the portal.

If your app generates additional semantic utilities, import `@mastra/playground-ui/new-theme.css` into its Tailwind stylesheet so Tailwind can read the `@theme inline` mappings.

## Responsive app layout

`AppLayout` composes `SidebarNew` directly. Pass the sidebar's contents, not another sidebar root. It owns the sidebar provider, a desktop sidebar beside the frame, and a mobile header with a navigation trigger below 1024px. The optional `mobileHeader` slot sits beside that trigger. Mobile navigation defaults to the existing takeover; use `mobileMode="drawer"` for the narrower drawer. Both modes reuse the sidebar's Escape handling, focus trap, focus restoration, and close-on-navigation behavior.

```tsx
import { AppLayout, AppFrame, PageContent } from '@mastra/playground-ui/new/layout/app-layout';
import { SidebarNew } from '@mastra/playground-ui/new/sidebar';
import { Breadcrumb, Crumb } from '@mastra/playground-ui/components/Breadcrumb';
import { PageHeader } from '@mastra/playground-ui/components/PageHeader';

export function Workspace() {
  return (
    <AppLayout
      sidebar={
        <>
          <SidebarNew.Header>
            <SidebarNew.Brand title="Acme" />
            <SidebarNew.Trigger />
          </SidebarNew.Header>
          <SidebarNew.Nav>
            <SidebarNew.NavList>
              <SidebarNew.NavLink link={{ name: 'Agents', url: '/agents' }} />
            </SidebarNew.NavList>
          </SidebarNew.Nav>
        </>
      }
      sidebarProviderProps={{ storageKey: 'acme-navigation' }}
    >
      <AppFrame
        breadcrumb={
          <Breadcrumb.Bar>
            <Breadcrumb.Item pathname="/agents">
              <Crumb as="span" isCurrent>
                Agents
              </Crumb>
            </Breadcrumb.Item>
          </Breadcrumb.Bar>
        }
      >
        <PageContent aria-label="Agents" pageHeader={<PageHeader title="Agents" />}>
          <p>Your agents appear here.</p>
        </PageContent>
      </AppFrame>
    </AppLayout>
  );
}
```

`AppFrame` provides the border and desktop inset, but never scrolls. On phones it has no outer margin and spans the full available width. Its optional `breadcrumb` slot accepts `Breadcrumb.Bar`; omitting it leaves no header row.

`PageContent` is the focusable `main` landmark and the only page scroll container. It composes `ScrollArea` with the same hover/scroll overlay scrollbar treatment as SidebarNew. Its optional `pageHeader` scrolls with the body. Do not nest another `main` inside it. All three components forward native attributes and refs. Layout spacing can be customized through `className` without changing existing component tokens.

The stack does not create a router or render an outlet itself. Replace the body with your router's `<Outlet />`, or omit both chrome slots for an outlet-only page:

```tsx
<AppFrame>
  <PageContent aria-label="Current page">
    <Outlet />
  </PageContent>
</AppFrame>
```

Pass your router's link adapter through `sidebarProviderProps.LinkComponent` if needed. Provider options such as width and storage key remain available; the mobile breakpoint is fixed at 1024px to match the frame. `AppShell` and `PageShell` keep their existing APIs and consumers.

The composition reuses migrated `SidebarNew`, `Breadcrumb.Bar`, and `PageHeader`. No copied or isolated legacy components are needed. New surfaces use `new-theme.css` semantic colors; the reused page title defaults to Marvin's `header-md` role and the description to `ui-sm`.

### Storybook responsibilities

- **Layout / AppLayout** is the canonical app composition example. It covers full chrome, optional headers, body-only content, scrolling, and phone layouts.
- **New / SidebarNew** covers sidebar behavior: header variants, collapse and expand, navigation stacks, account menus, and footer metadata. AppLayout reuses this story group's sidebar content fixture.
- **Layout / AppShell** remains regression coverage for existing consumers. Keep its API and behavior supported, but use AppLayout as the starting point for new layouts. Its sidebar provides context for the older shell; it does not need another complete set of navigation demonstrations.

From the repository root, start Storybook and run the layout's browser checks in a second terminal:

```bash
pnpm --filter ./packages/playground-ui exec storybook dev -p 6019 --no-open
node packages/playground-ui/browser-tests/app-layout.mjs http://localhost:6019
```

The browser checks reuse the monorepo's installed Playwright from `packages/playground`. They cover scrolling, optional chrome, keyboard focus, navigation dismissal, and resizing at desktop, tablet, and phone widths.

## Documentation

This README is the package guide. Import the global stylesheet once, then use the package's explicit `components/*`, `domains/*`, `hooks/*`, `icons/*`, `primitives/*`, `store/*`, `tokens`, and `utils/*` entry points rather than a package-root import.

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/packages/playground-ui/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
