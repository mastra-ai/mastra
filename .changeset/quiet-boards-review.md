---
'@mastra/factory': minor
---

The default Work board no longer has a self-review phase. New projects get Intake, Triage, Planning, Building, Review and Done (plus Canceled): Building opens the change request itself and moves the card to Review, where the pull request is reviewed. Review keeps the key `pr-review`.

Self-review is now something a board opts into rather than a default. Any board can add a working phase in the `review` context that grants only `factory_record_review_verdict`; the builder then hands its branch there before a change request opens, as long as the project's self-review setting is on. The setting, its signal line and its UI switch only show for boards that have such a phase.

Existing projects keep the Work board they have: a project whose stored Work board still holds the `review` self-review phase keeps running it, with no migration. Edit the Work board to drop the phase if you no longer want it.
