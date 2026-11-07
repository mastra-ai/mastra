# Building playground-ui components

<overview>
A playground-ui component is paid for by every page that renders it. A local color, height, or `useMemo` in one shared part becomes drift on every screen at once, and the next token change skips it. So a new component is built only from the design system's own primitives and semantic roles, follows the same React rules as the rest of the package, and ships with stories and behavior tests that prove both themes.

Composing components on a page is the job of `rules/`. This file covers creating one.
</overview>

<context>
The code is the source of truth. If this file and the code disagree, the code wins: build from the code and report which line here drifted.

| Concern                       | Source                                                                                                                                                         |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Semantic color roles          | `theme.css` (neutral roles), `theme/status.css` (status, badge, product), `theme/data-viz.css` (chart, span), `theme/surfaces.css` (fill and boundary ladders) |
| Surfaces                      | `src/ds/primitives/raised-surface.ts`, `src/index.css` (`shadow-raised`, `shadow-overlay`, `state-layer`)                                                      |
| Fields and selection controls | `src/ds/primitives/form-element.ts`, `src/ds/primitives/selection-control.ts`                                                                                  |
| Sizes                         | `src/ds/primitives/control-size.ts`, `src/ds/icons/icon-size-classes.ts`                                                                                       |
| Text                          | `theme/typography.css`, `src/ds/components/Txt/Txt.tsx`, `src/ds/primitives/typography.ts`                                                                     |
| Motion                        | `src/ds/primitives/transitions.ts`, `theme/motion.css`                                                                                                         |
| Export contract               | `src/components-exports.test.ts`                                                                                                                               |
| Color checks                  | `scripts/check-color-usage.mjs --report`; `src/theme-export.test.ts` for the token contract                                                                    |

Recent references for a whole component PR: `FileDropBackdrop` (#25299) and `MetricsStackedBarChart` (#25322). `Notice` is the reference for a compound component.

</context>

<workflow>
1. Decide whether the component should exist, with the tree in section 1. Stop and propose it to a frontend code owner with two named call sites before writing it.
2. Read `rules/core.md`, `rules/copy.md`, and `rules/interface.md`. Inside `mastra`, also load the `react-best-practices`, `tailwind-v4`, and `playground-msw-tests` skills in `.claude/skills/`.
3. Open the closest existing component and copy its folder shape, file naming, and story title section.
4. Design the props API (section 3), then write the parts from primitives (sections 4 and 5).
5. Write stories and behavior tests (section 6).
6. Run the checks in the quality checklist, then replace the call sites' local code with the new component.
</workflow>

<instructions>

## 1. Does it need to exist

```text
Does an existing ds component do the job with a variant, size, tone, or slot?  -> use it (rules/)
Does composing existing parts at the call site cover it?                       -> compose locally
Is it a new variant or state of an existing control?                           -> change that control, not a new component
Does it fetch data or know a domain type (agent, trace, workflow)?             -> src/domains/<domain>/components, not ds
Are there fewer than two real call sites?                                      -> compose locally; extract at the second
Otherwise                                                                      -> new ds component, after a frontend code owner agrees
```

Search `src/ds/components`, `src/ds/new`, and `src/domains` by role, not by name, before deciding. The most common slop here is a second component for a job one already does under another name.

## 2. Folder and exports

- One folder per component: `src/ds/components/<PascalName>/`. Files are kebab-case: `<name>.tsx`, `<name>.stories.tsx`, `<name>.test.tsx`, and `index.ts`. A compound component splits one part per file (`notice-root.tsx`, `notice-message.tsx`).
- `index.ts` is required. `vite.config.ts` publishes every folder as `@mastra/playground-ui/components/<PascalName>`, and a folder without `index.ts` silently drops out of `dist`. `index.ts` re-exports only its own folder.
- A compound component is `Object.assign(Root, { Part })`, exported as one name, as `Notice` does.
- Import siblings by file path (`../Txt/Txt`, `@/ds/primitives/transitions`), never through another folder's `index.ts` or a barrel. Merge classes with `cn` from `@/lib/utils`, never `twMerge` directly, because only `cn` knows the design-system scales.

## 3. Props API

- Extend the element's native props (`ComponentProps<'div'>`, or the Base UI part's props) and spread the rest onto the root, so `id`, `aria-*`, `data-*`, and `ref` pass through. React is 19: `ref` is a prop, so never add `forwardRef`.
- `className` is merged last with `cn` and exists for the caller's layout only. The component owns every look property.
- The common case needs zero props. Default text slots follow `rules/copy.md` (`FileDropBackdrop` defaults to "Drop to upload").
- Text goes through `children` or a named slot typed `ReactNode`, never through a `string` prop that the component then styles. The slot applies its most common text role by default.
- Variants name intent (`destructive`, `ghost`, `subtle`), never a look (`red`, `big`). Hue names are allowed only for a palette of kinds, as `Badge` has.
- Variant classes are complete strings in `cva` or a `satisfies Record<Variant, string>` map. Never build a class from a template literal (`` `bg-${tone}-subtle` ``): Tailwind cannot see it, so the class is never generated.
- A requirement lives in the type. An icon-only control takes a required `aria-label`, and states that cannot coexist are one union prop, not two booleans.
- Interactive behavior (focus, menus, popups, toggles) builds on `@base-ui/react`. Polymorphism is Base UI's `render` prop. Never add `asChild`, `as`, `href`, or a new Radix import.
- Absence is `undefined` and `?`, never `null`. No `as` casts except `as const`.

## 4. Semantic colors

A component names what a pixel is for, never what color it is. Roles flip between themes on `html.light` and passed contrast checks in both; a literal or a ramp step does neither.

```text
What is this pixel?
|-- Text or icon ink            -> foreground | muted-foreground | placeholder (Txt tone when rendering Txt)
|-- A surface
|   |-- In the flow (card, panel, list)   -> raisedSurfaceStyle
|   |-- Detached (popover, menu, tooltip)  -> overlaySurfaceStyle
|   |-- A dialog or drawer                 -> dialogSurfaceStyle
|   |-- The app frame or a docked panel    -> frameSurfaceStyle
|   \-- An opaque sticky panel             -> bg-surface-panel
|-- A state on top of a surface
|   |-- On a transparent base (ghost, row) -> bg-fill-subtle
|   |-- On an opaque surface               -> surfaceStateLayerStyle (state-layer)
|   \-- A field or selection control       -> form-element.ts / selection-control.ts, which pick the fill rung
|-- A control that IS a color              -> fill-inverse-* (primary) | fill-destructive-* (destructive)
|-- An edge
|   |-- Divider inside a surface           -> border
|   |-- Only affordance of a transparent control -> border-strong, border-hover on hover
|   |-- Focus                              -> border-focus / ring, via focusRing or controlFocusBorderVisible
|   \-- The rim of a raised or overlay surface -> already drawn by its shadow utility; add no border
|-- A state (success, destructive, warning, info) -> the Color tree in rules/color-and-status.md:
|       tint {status}-subtle + {status}-edge, text on it {status}-subtle-foreground, marks on the plain page {status}-indicator
|-- A kind                                 -> badge-{hue}*, product-*, chart-* (data only), span-*
\-- None of these                          -> stop: a missing role is a token question for a frontend code owner
```

- A ds component MUST NOT use a ramp step (`green-500`, `purple-700`), a foundation step (`gray-*`, `gray-alpha-*`, `background-1` to `3`), an `accent*` token, or a literal `#hex`, `rgb()`, `hsl()`, or `oklch()`. The contract lets product code use a ramp with a `dark:` pair for a one-off; a shared component is not a one-off, so it gets a role instead.
- Never write `dark:` on a role. The role already flips, and a `dark:` override is correct in one theme only.
- A `-subtle-foreground` ink is tuned for the tint it sits on. Use it only on that tint; on the plain page it turns near-white or near-black.
- Opacity comes only from tokens that carry it: the fill ladder, `border`, `surface-rim`, and `scrim`. Never add `/NN` to a chromatic role, `color-mix()`, `fillOpacity`, or `opacity-*` for a resting or disabled color. A translucent color changes on every surface it lands on, so its contrast can no longer be checked.
- A value that exists only at runtime (a per-agent hue) is a CSS custom property consumed as `bg-(--agent-color)`, not a new `@theme` token.
- New roles and changes to existing ones need a frontend code owner's approval.

## 5. Size, text, surface, motion

- A part that sits in a row of controls reads `ControlSizeContext` and takes its height from `controlHeight`, so `ButtonsGroup` can size it. Never write `h-*` on a control part by hand.
- Text in the component's own markup uses role utilities (`text-label`, `text-body-sm`, `text-caption`) or `Txt`. Never add `leading-*`, weight, or `tracking-*` beside a role.
- Icons are `size-icon-*` or `iconSizeClasses`, set per size variant.
- Radius matches the family: take it from the closest sibling (`Card`, an inset `Table`, and `DataList` share one, popups share another). A raised surface never adds `border`, because its shadow utility already draws the rim and a second line reads as a frame.
- Transitions use `transitions.ts` presets with named properties and the durations in `theme/motion.css`. Never `transition-all`. Every animation has a `motion-reduce:` path.
- Disabled changes color through `muted-foreground` or a disabled fill rung, never `opacity-*`, and hover and active rules are guarded with `not-disabled:`.
- Lengths are scale steps. `[Npx]`, `[Nrem]`, and `[Nem]` are defects.

## 6. React rules

`react-best-practices` is the standard. Open the rule file before applying it; these are the rules a new component breaks most:

| Rule                                                                               | What it means in a ds component                                                                                                                                                                                                                                                                                                                        |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `structure-composition-over-config`                                                | Parts as children (`<Notice.Message>`), not an `items` config array mapped onto one shape                                                                                                                                                                                                                                                              |
| `structure-narrow-apis`                                                            | No `options` bag; a root with many props splits into parts                                                                                                                                                                                                                                                                                             |
| `structure-single-responsibility`                                                  | One part per file; the root does not also own a sub-part's state                                                                                                                                                                                                                                                                                       |
| `structure-derive-dont-duplicate`                                                  | No prop that another prop determines                                                                                                                                                                                                                                                                                                                   |
| `structure-early-return-render-branches`                                           | One layout wrapper; branch the body, not the shell                                                                                                                                                                                                                                                                                                     |
| `rerender-no-usememo-usecallback`                                                  | No `useMemo` or `useCallback`                                                                                                                                                                                                                                                                                                                          |
| `rerender-no-setstate-in-render-or-effect` and `rerender-no-useeffect-state-reset` | Derive during render; reset by remounting with a `key`                                                                                                                                                                                                                                                                                                 |
| Effects (`rules/core.md`)                                                          | `useEffect` and `useLayoutEffect` only to sync with something outside React: a DOM API with no ref-callback form, a global event such as `keydown` on `window`, or a third-party widget. Never to derive state, fetch, or reset. Prefer a ref callback or `useSyncExternalStore` when either fits, since an effect renders twice and races its cleanup |
| `types-no-type-assertions` and `types-no-null`                                     | No `as`, no `null` in props or state                                                                                                                                                                                                                                                                                                                   |
| `bundle-barrel-imports`                                                            | Direct file imports only                                                                                                                                                                                                                                                                                                                               |
| `rendering-animate-svg-wrapper`                                                    | Animate the wrapper, not the `<svg>`                                                                                                                                                                                                                                                                                                                   |

## 7. Stories and tests

- Write stories in CSF3, copying the closest sibling's story file. Stories go under the Storybook section the closest sibling uses (`Elements/`, `Composite/`, `Layout/`, `Feedback/`, `DataDisplay/`, `Navigation/`, `Forms/`). Cover every variant, size, and state, including disabled, loading, empty, and long text, and show the component on the surfaces it will sit on (canvas, card, dialog).
- Tests assert behavior a user can see: role, name, keyboard, focus, and callbacks. Colors are asserted on computed styles in both themes, never on class strings, because a class-string test passes when the variable resolves to nothing.
- A component that fetches or gates on data is tested with `playground-msw-tests`: the real `@mastra/client-js` and React Query stack, network mocked only.
- Run the suite with `NODE_OPTIONS=--no-experimental-webstorage`. Node's experimental localStorage breaks storage-dependent suites.

## 8. Ship

- Add a `minor` changeset for `@mastra/playground-ui` per `.mastracode/commands/changeset.md`, saying what the component lets a developer do.
- Replace the call sites' local versions in the same change, so the component lands with its two uses.
- Apps that install the published package get the component only after release. Say so in the PR.

</instructions>

<constraints>
- MUST NOT create a ds component for a single call site.
- MUST NOT change `theme.css`, `theme/*`, `src/ds/tokens/*`, or an existing variant's classes without a frontend code owner's approval for that change.
- MUST NOT add comments, including JSDoc on props. Stories and names carry the documentation.
- MUST NOT add a dependency. Base UI, `class-variance-authority`, `lucide-react`, and Tailwind cover component work.
</constraints>

<quality-checklist>
- [ ] Two call sites are named, and a frontend code owner agreed the component should exist
- [ ] The folder has `index.ts`, kebab-case files, a story, and a test; `components-exports.test.ts` passes
- [ ] Props extend the native or Base UI props, spread the rest, and take `ref` as a prop; no `forwardRef`, `asChild`, `as`, or `null`
- [ ] Every color walked the tree in section 4 and names a role; no ramp, foundation, `accent*`, literal, `dark:` color, or opacity modifier on a chromatic role
- [ ] `-subtle-foreground` inks appear only on their own tint, and status marks on the plain page use `{status}-indicator`
- [ ] Surfaces come from `raised-surface.ts`, fields from `form-element.ts`, heights from `control-size.ts`; no hand-written `border` beside a shadow rim
- [ ] Text uses roles, icons use `icon-*` tokens, lengths are scale steps, transitions name their properties and respect reduced motion
- [ ] No `useMemo`, `useCallback`, `setState` in an effect, `as` cast, or barrel import
- [ ] Every `useEffect` or `useLayoutEffect` syncs with something outside React, and no ref callback or `useSyncExternalStore` could replace it
- [ ] `node packages/playground-ui/scripts/check-color-usage.mjs --report --component <Name>` shows no legacy or foundation tokens
- [ ] `pnpm --filter ./packages/playground-ui lint`, `typecheck`, and `test` pass
- [ ] Stories render every variant and state in both themes on every surface the component sits on
- [ ] The call sites use the new component, and a `minor` changeset describes it
</quality-checklist>
