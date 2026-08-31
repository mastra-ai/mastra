---
'@mastra/factory': minor
---

Runs started by the Factory no longer stall without appearing in Needs attention.

A run that writes a plan used to suspend inside its thread and wait forever: the card said Building, nothing built, and no error appeared anywhere.

**Added: an Auto-approve plans switch on the board**

Off by default, which is what runs already did — except a plan nobody is watching now surfaces in Needs attention instead of hanging. On, the Factory answers the plan itself and the run carries the item through to Done. An agent that keeps re-planning is stopped after three approvals and handed to a person.

```ts
await fetch(`/web/factory/projects/${projectId}`, {
  method: 'PATCH',
  body: JSON.stringify({ autoApprovePlans: true }),
});
```

**Fixed: who a parked plan waits for**

A plan on a rule-started run escalates through the rule's own decision, the record Needs attention is built on. A plan on a run a person started keeps waiting for that person, because that pause is the point.

**Fixed: two smaller holes on the same path**

An agent asking to move its own card no longer parks the run behind an approval prompt nobody is watching; the rules engine still governs every move. And a failure that can never succeed on a retry stops burning attempts before it reaches someone.
