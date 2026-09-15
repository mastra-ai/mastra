# Playground UI guidance

<commands>

- Build from root: `pnpm build:playground-ui`
- Test from root: `pnpm --filter ./packages/playground-ui test`
- Typecheck: `pnpm --filter ./packages/playground-ui typecheck`

`build` runs `vite build`; `vite-plugin-dts` emits declarations and gates type errors through `afterDiagnostic`. Use `typecheck` for an explicit `tsc` gate. The package build takes about eight seconds. A slow root build usually means Turbo is rebuilding upstream dependencies through `^build`.

</commands>

<rules>

## Testing

- Vitest, MSW, and typed `@mastra/client-js` fixtures are the primary testing strategy.
- Tests MUST drive the real `@mastra/client-js` and React Query stack and mock only the network.
- Tests MUST NOT mock package data hooks, services, or auth gating.
- Fixtures MUST live in a nearby `__tests__/fixtures/` directory and use response types re-exported from `@mastra/client-js`.
- Use the `playground-msw-tests` skill for business hooks, data components, gating, and React Query flows.
- Use Playwright E2E through `e2e-tests-studio` only when MSW cannot model the journey.

## Typography

- Product copy SHOULD use `Txt` variants. Low-level primitives MAY use `text-ui-*` or `text-header-*` utilities.
- Code MUST NOT use `text-xs`, `text-sm`, `text-base`, `text-lg`, larger Tailwind text sizes, or arbitrary pixel sizes. Lint enforces this.
- Typography tokens include their paired line-height. Code MUST NOT add a separate `leading-*` unless an existing design-system exception requires it.
- Headings MUST use the established hierarchy:
  - Page heading: `header-md`.
  - Hero heading: `header-xl`.
  - Section heading: `header-sm`.
  - Panel heading: `ui-md`.
- Review `Foundations/Tokens / Typography` in Storybook before changing typography tokens or heading conventions.

## Color

- Plain `:root` color variables in `theme.css` are raw foundations and do not generate Tailwind utilities. Only `@theme` variables generate utilities.
- Background foundations describe nesting: `background-1` is sidebar or outer chrome, `background-2` is the main canvas, and `background-3` is cards and panels.
- Gray foundations describe contrast strength, not lightness. `gray-1` is subtle and `gray-10` is strong. The tonal direction reverses between dark and light themes so the same step preserves its role.
- Gray alpha uses white overlays in dark mode and black overlays in light mode. Higher steps increase opacity and contrast.
- Components MUST use semantic color utilities when they exist. Raw foundations MUST NOT replace existing tokens outside an explicitly approved migration.
- Review `Foundations/Color foundations` in Storybook before changing foundations, aliases, or theme mappings.

## Components

- Preserve design-system consistency and existing component APIs.
- Consumer code MUST NOT override a DS component's colors, typography, borders, radius, shadow, or internal padding through `className`.
- Do not add `asChild`; use Base UI's native `render` prop.

</rules>

<verification>

- Run the narrow unit or integration tests before E2E.
- Run typecheck for every TypeScript change.
- UI handoff MUST include mobile, tablet, and desktop screenshots.
- Color and typography changes MUST be checked in dark and light themes through their Storybook foundation stories.
- Run `e2e-frontend-validation` before merging when it applies.

</verification>
