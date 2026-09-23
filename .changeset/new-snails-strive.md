---
'@mastra/playground-ui': minor
---

Fields now stand out from the card, dialog, or drawer they sit in, and fields with errors show a red outline.

**Fields on surfaces**

Text fields, textareas, input groups, and the default Select, Combobox, and DateTimePicker triggers pick their fill and outline from the surface around them. Inside a card, dialog, or drawer they're one step lighter in dark mode and get a stronger outline in light mode. Dialogs, drawers, and alert dialogs use a new `--dialog` surface that is off-white in light mode. Nothing changes at the call site.

**Error outline**

Passing `error` to Input, Textarea, InputGroup, Select, Combobox, or CodeEditor now shows a red outline on every surface. Before, the red border was hidden behind the field's shadow.

New tokens: `--dialog`, `--field`, `--field-on-surface`, `--field-disabled`, `--field-rim`, `--field-rim-focus`.
