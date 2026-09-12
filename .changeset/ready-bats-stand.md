---
'@mastra/playground-ui': patch
---

Removed the built-in minimum widths from the Combobox trigger and from the Combobox, Select, DropdownMenu, ContextMenu and SelectDataFilter popups. Popups no longer stretch to match their trigger width and now size to their content; pass a min-width via className at the call site when a wider trigger or popup is needed. Existing call-site `min-w-*` overrides on Select triggers (agents/entities sort, rule-engine field/operator/value selects) and DropdownMenu content (trace columns menu, agent review filters) were dropped so they size to content.
