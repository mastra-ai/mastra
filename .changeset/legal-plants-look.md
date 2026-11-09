---
'mastracode': minor
---

With the **Mouse** setting in `/settings` at **Input box only** or **Dialogs + input box**, typing or editing in the input box captures the mouse: click to move the cursor, drag to select text (the selection is copied to your clipboard), and type, paste, or press Backspace to replace or remove the selection. The right side of the status line shows `mouse mode: auto` while the mouse is captured and `mouse mode: off` while the terminal has it.

The mouse goes back to the terminal when you send a message, scroll the mouse wheel, or click outside the input box, so the terminal's own scrolling and text selection come back as soon as you reach for them (that first wheel tick or click is used up handing the mouse back).

While text is selected, Esc clears the selection first, so with Esc-to-cancel on, a second Esc cancels the run.
