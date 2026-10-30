---
'@mastra/factory': minor
---

Organization admins can now create, edit and delete a project's own boards through the API. Saved boards pass the same checks as `defineBoard()`, and every change sends back the revision it read, so two people can't overwrite each other's edits.

```bash
curl -X POST "$FACTORY_URL/web/factory/projects/$PROJECT/boards" \
  -H 'content-type: application/json' \
  -d '{ "key": "bugs", "name": "Bugs", "phases": [{ "key": "reported", "name": "Reported", "kind": "resting" }, { "key": "fixed", "name": "Fixed", "kind": "terminal" }] }'
```

`GET /web/factory/projects/:id/boards/:boardKey` returns a board's definition, `PATCH …/boards/:boardKey` replaces it with `expectedRevision`, and `DELETE …/boards/:boardKey?expectedRevision=n` deletes it. Factory refuses edits that would strand cards (`409 phase_in_use`, `409 board_in_use`) and runner skills that don't exist (`422 unknown_skill`).

The built-in Work and Review boards and boards passed to `new MastraFactory({ boards })` are read-only here: creating, editing or deleting one returns `409 code_board`, and the catalog and `GET` report them with `editable: false`.

`defineBoard()` and the `boards` and `includeDefaultBoards` options of `MastraFactory` are deprecated. They keep working, their boards are not stored, and Factory logs one deprecation warning per process. Apps that use only the built-in boards see no warning. See the "Stored boards" and "Migrating from `defineBoard()`" sections of the README.
