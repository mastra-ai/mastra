---
'@mastra/factory': minor
---

Added a Boards section to Factory settings, replacing Skills. You can now customize what an agent does when a card enters a board phase:

- **Skill library:** create, edit, and delete your own skills for the Factory.
- **Per-phase kickoff:** set each working phase on any board (built-in or custom) to run a library skill or your own prompt, or reset it to the board default.

The card's details are still passed to the agent with your skill or prompt. When a phase is re-entered while its library skill is still running, the agent is told to continue that pass rather than receiving the skill again. If you delete a skill, every phase that used it goes back to the board default. These settings apply to the whole Factory.

```http
POST /web/factory/projects/:id/skill-library
{ "name": "my-build", "description": "How we build.", "content": "Build it well." }

PUT /web/factory/projects/:id/phase-skills/work/execute
{ "skillName": "my-build" }
```
