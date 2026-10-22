---
'@mastra/factory': minor
---

Factory now runs each project's boards from its database. New projects get the Work board seeded on creation and existing projects are seeded in the background at startup; the stored board behaves exactly like the built-in Work board until edited. A phase's `nextPhases` limits where a card can move from it, for agents and people alike, and stored intake routes decide which board and phase a new GitHub or GitLab issue lands on (existing label routes and repository bindings still apply). `includeDefaultBoards: false` skips seeding.
