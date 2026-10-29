---
'@mastra/factory': minor
---

Organization admins can now create, edit, reset and delete a project's boards through the API, including the built-in Work and Review boards.

```bash
# Rename Work's Building phase: send the whole board back with the revision you read.
curl "$FACTORY_URL/web/factory/projects/$PROJECT/boards/work"
curl -X PATCH "$FACTORY_URL/web/factory/projects/$PROJECT/boards/work" \
  -H 'content-type: application/json' -d '{ "name": "Work", "phases": [...], "expectedRevision": 1 }'
```

`POST /web/factory/projects/:id/boards` creates a board, `PATCH …/boards/:boardKey` replaces one, `POST …/boards/:boardKey/reset` goes back to the code definition, and `DELETE …/boards/:boardKey` removes a board. Saves use the same checks as `defineBoard()`. Factory refuses edits that would strand cards, delete Work or Review, or break a board's code behaviors.

`defineBoard()` and the `boards` and `includeDefaultBoards` options of `MastraFactory` are deprecated. They keep working: the boards you pass are only used to seed each project's database, and Factory logs one deprecation warning per process. Apps that use only the built-in boards see no warning. See the "Stored boards" and "Migrating from `defineBoard()`" sections of the README.
