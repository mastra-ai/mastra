---
'@mastra/factory': patch
---

Fixed non-bug work items (feature requests, questions, docs) getting stuck after a maintainer moved them into Planning. The approval gate now remembers the first human move, so the plan agent can advance the card to Execute without a second manual drag. On acceptance, the GitHub `status: needs approval` label is removed automatically.

Held triage cards now show an explicit maintainer decision — **Accept and plan**, **Accept and build**, or **Close** — instead of a Build button that silently skipped approval, and the card status explains why it is waiting on a person.
