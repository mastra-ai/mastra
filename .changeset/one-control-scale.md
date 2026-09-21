---
'@mastra/playground-ui': minor
---

Every control reads one height scale — `sm` 28px, `md` 30px, `lg` 32px — and the tokens are named for what they size.

**Why**

The rungs were named `form-*`, but by the end they were sizing buttons, dropdown triggers, filter chips, input groups and sidebar nav rows. Only a third of those live in a form, and a nav row reading `h-form-sm` is a name arguing with its call site. The word every design system uses here is _control_: Primer names the pattern explicitly ("the pattern `control` can be used for multiple types of controls like buttons, inputs, or interactive items"), Spectrum treats `control-size` as a shared unit, and the rung is the one thing a button, a field and a row have to agree on.

The scale also had a fourth rung at 20px that nothing could use honestly: a control's label is 13px at every height, and 13px does not fit in 20px with any padding left over. Call sites reached for it anyway — 155 of them — so the densest surfaces were a rung below the rest of the app, and the two neighbouring rungs were 4px apart while `sm`→`md` was 8px.

**What changed**

`--spacing-control-sm|md|lg` replaces `--spacing-form-*`, and the 20px rung is gone: `size="xs"` becomes `sm` and `size="icon-xs"` becomes `icon-sm` at every call site. The three rungs now sit 2px apart, which is the point of a scale whose members share a type role — the box grows for touch and density, the label does not move. `md` is the default everywhere.

Sidebar nav rows read `controlHeight` like any other control instead of declaring their own heights, which is what lets a consumer delete its per-row size overrides: a nav row is a control, and it was only ever off the scale by accident.

The icon scale is renamed for the same reason. `sm | smd | default | lg` becomes `xs | sm | md | lg` (12 / 14 / 16 / 20), so there is no rung called `default` competing with the actual default and no `smd` between `sm` and what should have been `md`. With honest names, the two maps inside `Button` that translated a control size into a glyph size collapse into one, because the glyph rung and the control rung are now the same word.

**Consumers**

`h-form-*`, `w-form-*` and `min-h-form-*` become `h-control-*`, `w-control-*`, `min-h-control-*`. `<Icon size="sm">` is now 14px rather than 12px — the 12px rung is `xs` — and `size="default"` is `md`. `Badge`, `Kbd`, `Avatar`, `Spinner` and `ThemeToggle` keep their own scales, `xs` included; they are not controls and never read the control rung.
