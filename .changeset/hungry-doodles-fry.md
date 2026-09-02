---
'@mastra/factory': minor
---

Runs started by the Factory no longer stall without appearing in Needs attention.

A run that writes a plan used to suspend inside its thread and wait forever: the card said Building, nothing built, and no error appeared anywhere.

**Added: an Auto-approve plans switch on the board**

Find it in the board's automation settings, beside Auto-start runs. Off by default, which is what runs already did — except a plan nobody is watching now surfaces in Needs attention instead of hanging. On, the Factory answers the plan itself and the run carries the item through to Done. An agent that keeps re-planning is stopped after three approvals and handed to a person.

**Fixed: who a parked plan waits for**

With the switch off, where a parked plan goes depends on who started the run. A plan on a rule-started run escalates through the rule's own decision, the record Needs attention is built on. A plan on a run a person started keeps waiting for that person, because that pause is the point. With the switch on, the Factory answers both.

**Fixed: two smaller holes on the same path**

An agent asking to move its own card no longer parks the run behind an approval prompt nobody is watching; the rules engine still governs every move. And a failure that can never succeed on a retry stops burning attempts before it reaches someone.
