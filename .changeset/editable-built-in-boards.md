---
'@mastra/factory': minor
---

Added editing of the built-in Work board and app boards per project. Each project gets its own copy of Work and of every board passed to `MastraFactory({ boards })` the first time the boards API reads it. An admin can edit that copy under the board's own key, and Factory runs the edited board with its code behaviour still attached. For example, Planning can start and approve its plan on its own for cards labelled `effort:low`:

```bash
# Edit the project's Work board (the whole board, with its revision)
curl -X PATCH "$FACTORY_URL/web/factory/projects/$PROJECT/boards/work" -H 'content-type: application/json' -d @work.json

# Back to Factory's default
curl -X POST "$FACTORY_URL/web/factory/projects/$PROJECT/boards/work/reset" -H 'content-type: application/json' -d '{"expectedRevision": 3}'
```

**What you can change:** names and descriptions, next phases, when a phase starts on its own, when its exit tool is approved on its own, runner instructions, and new phases.

**What stays fixed:** phases the code declares, their kind, the first phase, the runner context and skill of phases whose work runs in code, declared exit tools and outcome targets. Edits that change these are refused with `422 code_behaviour`, listing each conflict.

Board responses now include `customized` and `defaultChanged`, so you can see when Factory's default changed after your edit. Unedited boards keep following the running Factory version. Code boards still can't be deleted or created over (`409 code_board`), and the legacy Review board stays read-only.
