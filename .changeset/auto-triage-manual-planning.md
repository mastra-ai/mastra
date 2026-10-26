---
'@mastra/factory': minor
---

New issues now land in Work › Triage, so triage runs on arrival, while Planning stays a human decision. A phase can be marked people-only with `manualEntry: true` (Settings › Boards: "Only people move cards here"); agents asking to move a card into it get `approval_required` and the card stays where it is.

```ts
{ key: 'planning', name: 'Planning', kind: 'working', manualEntry: true, runner: { type: 'agent', agentId: 'factory-plan', skill: 'factory-plan' } }
```

Projects that already stored their boards keep their current routes; edit the fallback intake route to `work › triage` to triage issues automatically.
