---
'@mastra/factory': minor
---

Runs started by the Factory no longer stall without appearing in Needs attention.

A run that writes a plan used to suspend inside its thread and wait forever: the card said Building, nothing built, and no error appeared anywhere. A new **Auto-approve plans** switch on the board decides who answers that pause. Off — the default, and what runs already did — a plan nobody is watching surfaces in Needs attention. On, the Factory answers it and the run carries the item through to Done. The switch covers every run the project starts. Kickoffs now record who asked for them: a plan on a person-started run waits for that person, a plan on a rule-started run escalates.

Two smaller holes on the same path: an agent asking to move its card no longer parks the run behind an approval prompt nobody is watching (the rules engine still governs every move), and a failure that can never succeed on a retry stops burning attempts before it reaches someone.
