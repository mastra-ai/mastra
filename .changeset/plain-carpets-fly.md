---
'@mastra/playground-ui': patch
---

Fixed dropdowns, menus, comboboxes, and popovers being unclickable when opened inside a SideDialog (for example the dataset selector in the "Save as Dataset Item" panel on the Traces tab). These popups now render inside the dialog so they stay interactive within the modal drawer.
