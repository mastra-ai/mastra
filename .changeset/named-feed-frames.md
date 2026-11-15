---
'@mastra/factory': patch
---

Each board stream frame now names what changed: `{"cards":["<card id>"]}` for a card write, `{"cards":[],"sessions":["<session id>"]}` when a session's run starts, parks, is answered or ends, `{"cards":[]}` when only decisions moved, and `{}` when the server cannot tell which cards changed. `GET /web/factory/projects/:id/work-items?scope=sessions` also accepts `workItemId`, answering with the named cards the session list holds and the cards related to them, so an open board can reread only what a frame names. Older browsers ignore both and keep rereading everything.
