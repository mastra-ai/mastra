# Playground UI

<commands>

- Build: `pnpm build:playground-ui`
- Test: `pnpm --filter ./packages/playground-ui test`
- Typecheck: `pnpm --filter ./packages/playground-ui typecheck`

</commands>

<rules>

- Test data flows with Vitest, MSW, typed `@mastra/client-js` fixtures, and the real React Query stack. Mock only the network. Use Playwright only when MSW cannot model the journey.
- Consumer `className` MUST NOT override a DS component's look. Do not add `asChild`; use Base UI's `render` prop.

## Typography

- `text-ui-*` and `text-header-*` are the foundation. `Txt` is a convenience component that consumes them, not another scale. Prefer an existing `Txt` variant for product copy; primitives MAY use the utilities directly.
- Do not use Tailwind's default text sizes or arbitrary pixel sizes. Lint enforces this. A text token already supplies its paired line-height, so consumer code MUST NOT add `leading-*`.
- Heading roles: hero `header-xl`, page `header-md`, section `header-sm`, panel `ui-md`.

## Color

- Plain `:root` variables are raw foundations; only `@theme` variables generate utilities.
- Background numbers encode nesting: sidebar `background-1`, canvas `background-2`, panel `background-3`.
- Gray numbers encode contrast from subtle `1` to strong `10`; tonal direction reverses by theme. Alpha grays use white in dark mode and black in light mode.
- Components MUST use semantic colors when available. Raw foundations MUST NOT replace existing tokens outside an approved migration.

</rules>

<verification>

Review the matching `Tiger Team/Foundations` story before changing either system. Verify light and dark themes at mobile, tablet, and desktop widths. Run narrow tests before E2E and include handoff screenshots.

</verification>
