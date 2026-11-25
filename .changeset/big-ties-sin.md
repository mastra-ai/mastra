---
'mastracode': minor
---

Menus now open in place of the prompt instead of as pop-ups over the chat. This includes `/settings`, `/models` and its sub-menus, `/theme`, `/goal`, `/think`, `/threads`, `/login` and the other commands that open a menu. While the full-screen setup is open, menus still appear on top of it.

- **Lists** share the same layout: type to filter, arrow keys wrap around, the list scrolls only when the cursor reaches its edge, labels and descriptions line up in columns, and Backspace on an empty search goes back. Menus with letter shortcuts (such as `/mcp`) and text inputs keep their own keys.
- **Height:** a menu fits the terminal it opens in and keeps its height while you filter. Closing it brings back the chat rows it covered. Menus in the prompt's place ignore the `maxHeight` overlay option.
- **Breadcrumbs:** settings submenus show where you are ("settings › notifications").
- **API keys:** `/api-keys` removes a stored key with Delete only (Fn+Delete on a Mac laptop). Backspace used to remove it too; it now edits the search, and closes the menu when the search is empty.
- **Suggestions:** command suggestions no longer scroll the chat or leave blank rows under the status line.
- **Loading:** slow menus such as `/models` and `/model` show a loading row right away. Esc cancels only the menu it was waiting for.

`ModelSelectorComponent` no longer draws its own title, hint line or search field, and `titleColor` has no effect. `getSearchInput()` was removed. If you used it to filter the models, use `setFilter()`:

```ts
// Before
selector.getSearchInput().setValue('gpt');

// After
selector.setFilter('gpt');
```
