---
'mastra': minor
---

Added `mastra api factory board` commands to get, create, update and delete a Factory project's boards. Built-in and app boards are read-only.

```sh
mastra api factory board create <project-id> '{"key":"bugs","name":"Bugs","phases":[{"key":"reported","name":"Reported","kind":"resting"},{"key":"fixed","name":"Fixed","kind":"terminal"}]}'
mastra api factory board delete <project-id> bugs '{"expectedRevision":1}'
```
