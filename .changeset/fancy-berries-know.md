---
'@mastra/playground-ui': patch
---

Refreshed the visual style of form controls and popups for a softer, more consistent look:

- **Button:** thinner border (`border` instead of `border-2`); text-mode buttons use `rounded-full`; icon-mode buttons are circular.
- **Combobox / Select / DropdownMenu / Command:** triggers and items aligned on the form-input look — `rounded-lg` border, transparent background, soft hover/open states, consistent `text-ui-smd` typography.
- **Popups (Popover / Tooltip / Select / Dropdown content):** `rounded-xl` containers with `shadow-dialog`; inner items `rounded-lg` inside `p-1`.
- **Tokens:** bumped the radius scale (`sm` 2→4px, `md` 4→6px, `lg` 6→10px, `xl` 12→14px); replaced `--shadow-dialog`'s outer 1px ring with an inset top gloss so the dialog shadow stops doubling up with each consumer's own border.
