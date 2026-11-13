# Core rules

<overview>
Mastra UI is composed from design-system parts, never painted by hand. Every decision in this file already has an answer in the code, so an agent that walks these trees builds the same screen a teammate would. When a tree has no branch for the case, the fix is a design-system change agreed with a frontend code owner. Local styling is never the fix. Every UI change loads this file; the topic files hold the trees.
</overview>

<context>
The code is the source of truth. If this file and the code disagree, the code wins: build from the code and report which line here drifted. Check names against what you can import: a component's props type in `@mastra/playground-ui/components/<Name>` lists its real variants and sizes, `theme/*.css` lists every token, and anything marked `@deprecated` is not for new code.

Reference pages: a `narrow` page is `mastracode/factory-ui/src/ui/pages/ActivityPage.tsx`; settings on `narrow` are `mastracode/factory-ui/src/ui/pages/SettingsPage.tsx` and `SlackConnectionPage.tsx`; a detail page is `packages/playground/src/pages/mcps/[serverId]/index.tsx`; a `fit` list page is `packages/playground/src/pages/tools/index.tsx`. Studio's `/settings` still uses the older `SettingsLayout` frame, so do not copy it.

Release status: Studio builds `playground-ui` from the workspace, so everything on `main` is available there. Other apps install the published package, and some pin a snapshot built from a branch, so the installed code can be older or newer than `main`. Before using an API outside Studio, check it in the installed package (`node_modules/@mastra/playground-ui/dist`). If it is missing, use what the installed version has and say which upgrade would replace it. Never copy unreleased markup locally.
</context>

<workflow>
1. Read the repository and surface instructions first (`AGENTS.md`, nearest first).
2. Find the closest existing page in the same product area and open it. Note its shell, layout variant, header, toolbar, and control sizes. Check later changes before using it; an approved redesign may have been superseded or reverted.
3. Choose the page frame with `page-frame.md`.
4. Choose each control with `controls.md`, and each color and status with `color-and-status.md`.
5. Assign every piece of text a role with `text.md`, and write it with `copy.md`.
6. Write the component code with the `react-best-practices` skill (`.claude/skills/react-best-practices/` in `mastra`; Platform keeps its own copy).
7. Put `className` only on layout, per the restyling rules below.
8. If no tree branch fits, stop and propose a design-system change. Do not work around it.
9. Walk each loaded file's checklist, then check the route in a browser at desktop and mobile widths, in both themes and every state it can reach.
</workflow>

<instructions>

## Do not restyle

A DS component's look belongs to the component; its placement belongs to the caller. This split is what lets one token change fix every screen. A local override opts that screen out of every future fix, and the drift only surfaces when someone notices two "identical" controls that no longer match.

`className` on a DS component MAY set:

- position and flow: `flex`, `grid`, `col-span-*`, `self-*`, `order-*`
- size constraints: `w-*`, `max-w-*`, `min-w-*`, `flex-1`, `shrink-0`
- outer spacing: `m*-*`; prefer `gap-*` on the parent

`className` on a DS component MUST NOT set: background, text color, text size, weight, line-height, border, radius, shadow, height, padding, opacity, or transition. The same ban covers `style`, CSS variable overrides, and wrapper elements that paint a surface around a component.

When the look is wrong:

1. Use a different variant, size, or `tone` prop on the same component.
2. Use a different DS component whose job matches, such as `Txt` instead of a styled `span`.
3. Compose DS parts: a slot, `render`, `InputGroup`, `ButtonsGroup`.
4. Otherwise stop. Propose the variant or component to a frontend code owner, naming at least two real call sites that need it. Do not change a token or a variant's classes without their approval for that specific change.

Arbitrary values (`text-[13px]`, `bg-[#111]`, `h-[29px]`) are never correct, in product code or in `playground-ui` itself. A token for the value exists, or the missing token is a design-system question.

- Lengths in any unit are banned: `px-[3px]`, `w-[274px]`, `py-[0.6rem]`, and `mt-[0.6em]` alike. Snap to the nearest scale step (`px-[13px]` becomes `px-3`, `py-[3px]` becomes `py-1`). A scale step is the fix even when it moves the element a pixel or two, because a one-off length is how a spacing system drifts.
- Icon sizes use the `icon-*` tokens, never `em`: `size-icon-xs|sm|md|lg`, or `iconSizeClasses` from `@mastra/playground-ui/icons/icon-size-classes` for a `[&>svg]` rule. An `em` size (`size-[1.1em]`) looks like it scales with text but produces sizes that match no token. When a control has size variants, set the icon token per variant, as `Button` does.
- A class that names no token (`text-ui-md`, a misspelled role) renders nothing and raises no error. Check every role and color name against `theme/`.

</instructions>

<constraints>
- MUST NOT change `theme.css`, `theme/*`, the token exports, or any variant's class string without a frontend code owner's approval for that change.
- MUST NOT use deprecated APIs in new code: `Section.*Row`, `components/SettingsRow`, the `*FieldBlock` components, `Button as|href|to`, `asChild`, `variant="filled"`, or anything marked `@deprecated`.
- MUST build from `@mastra/playground-ui` components. MUST NOT hand-roll a raw `<button>`, `<input>`, `<select>`, `<textarea>`, `<table>`, or `<dialog>`, and MUST NOT import Radix, Base UI, or a local shadcn copy directly, when a playground-ui component covers the job. A raw element skips the shared states, sizes, and focus handling, so it drifts on the next token change. When nothing covers it, follow step 4 of Do not restyle above.
- MUST NOT add a new shared component for a single call site. Compose locally, and extract once a second real call site exists, following `../build-component.md`.
- MUST import from the owning module path (`@mastra/playground-ui/components/Button`), never from a barrel.
- MUST follow the `react-best-practices` skill (`.claude/skills/react-best-practices/` in `mastra`; Platform keeps its own copy) for every component, page, and hook. It is the only React standard; these files do not restate it.
- MUST NOT call `useEffect` or `useLayoutEffect` in app and page code. An effect runs after paint, so it renders twice and flashes stale state. Derive during render, run work in the event handler, remount with a `key`, fetch with query hooks, or use a ref callback; when none fits, ask a frontend code owner. Inside a `ds/` component an effect MAY sync with something outside React.
</constraints>

<quality-checklist>
- [ ] The reference page is named, and the new screen uses its frame and control sizes
- [ ] No `className` on a DS component sets color, size, radius, shadow, padding, height, or text styling
- [ ] No arbitrary values, literal colors, or opacity used to dim text
- [ ] Lengths are scale steps and icon sizes are `icon-*` tokens; no `[Npx]`, `[Nrem]`, or `[Nem]`
- [ ] Every control, table, and dialog is a playground-ui component; no raw element or direct Radix or Base UI import stands in for one
- [ ] Every visible string passes the `copy.md` checklist
- [ ] No deprecated API appears in the diff
- [ ] The code follows `react-best-practices`, and app code has no `useEffect` or `useLayoutEffect`
- [ ] Anything these rules could not express was proposed as a design-system change, not styled around
- [ ] Token definitions, values, and variant classes are unchanged unless a frontend code owner approved each change
</quality-checklist>
