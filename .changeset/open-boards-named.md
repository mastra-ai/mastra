---
'@mastra/factory': patch
---

Factory agents can now find a board by the name it shows. `factory_list_work_items` accepts a board's id or its displayed name, lists every board by id and name, and refuses a name that matches several boards or none instead of returning an empty list.

```json
// factory_list_work_items input: the `work` board, shown as "Open source"
{ "board": "Open source", "stage": "intake" }
```
