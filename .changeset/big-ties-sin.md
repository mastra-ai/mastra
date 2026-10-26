---
'mastracode': minor
---

Menus now open in place of the prompt instead of as pop-ups over the chat, and every menu works the same way: type to filter, arrow keys wrap around, the list scrolls only when the cursor reaches its edge, labels and descriptions line up in columns, and Backspace on an empty search goes back. Settings submenus show where you are ("settings › notifications"), and slow menus such as /models show a loading row right away.

`ModelSelectorComponent` no longer draws its own title, hint line or search field (it shows them through the menu frame), `titleColor` is ignored, and `getSearchInput()` was removed. Typing still filters it when you show it on its own.
