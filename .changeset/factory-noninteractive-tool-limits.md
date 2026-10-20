---
'@mastra/factory': patch
---

Factory user sessions now keep their management tools on turns nobody signed in started, such as notification wakes, webhooks and rule notices. Before this change, those turns only had read and messaging tools. An orchestrator woken by a notification couldn't switch a usage-limited session's model or start a reviewer until a person posted.

Those turns can carry text other people wrote, so each tool limits itself on them:

- `factory_answer_approval`, `factory_resolve_proposal`, `factory_dismiss_decision`, and `factory_update_work_item` with `plansPreapproved` still need a person.
- `factory_transition_work_item` moves the card as the session's agent (`agent:session:<id>`, role `session`), so the plan-approval and done gates apply.
- `factory_switch_session_model` reaches only the session itself and the side sessions it started.
- `factory_subscribe_session` and `factory_unsubscribe_session` (muting a side session) still need a person.
- `factory_start_session` starts side sessions only. Starting a role on a work item still needs a person.
