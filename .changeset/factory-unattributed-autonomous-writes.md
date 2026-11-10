---
'@mastra/factory': patch
---

Fixed Factory labeling its GitHub comments, reviews, and pull requests with a person who did not ask for them.

- Sessions nobody asked for, such as the review agent started by a rule on a new pull request, no longer mark what they write "Opened by" whoever connected the repository, and pull requests they open are no longer assigned to that person.
- Messages sent from Slack to a shared session now name the person who sent them instead of the session's owner.

Work a person starts or releases still carries their name, including the runs that continue it. Sessions that already exist keep their current label; the fix applies to sessions started after upgrading.
