---
'@mastra/playground-ui': patch
---

Fixed phones zooming the page when you tap a text field. On a touch screen, every design system text field now shows its text at 16px, which is the size iOS Safari needs to skip the zoom. That covers Input, InputGroup, InputNumber, SearchInput, ListSearch, Textarea, the Combobox field and its popup search, Command, Composer, the comment editor, Tree rename, saved-view rename and the FilterBar input. Desktop sizes are unchanged.
