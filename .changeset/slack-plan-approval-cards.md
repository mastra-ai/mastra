---
'@mastra/factory': patch
---

Plans can now be reviewed and approved from Slack. When a session submits a plan with `submit_plan`, each Slack thread following its card gets one approval card built from the submitted plan: its title, goal, scope, phases, risks and open questions, an **Approve** button, and an **Open full plan** link. To ask for changes, reply in the thread.

Clicking **Approve** approves the plan as the Factory user linked to that Slack account. Only the session's owner, the person who filed the card, or someone following the card can approve, and the approval is recorded in the audit log. After the plan is answered in Slack, on the web, or by the thread agent, the card updates and its button is removed. Clicks on a card that was already answered do nothing.

Blocked notices sent to following sessions now include a summary of the submitted plan. The plan shown is the text the session submitted, so it matches exactly what an approval resumes. If that text isn't available, the notice and card say so, the card has no Approve button, and nothing says the plan was approved.
