---
'@mastra/factory': patch
---

Fixed who owns the sessions a Factory card runs in, and who can approve their plans.

**Who owns a card's phase session**

- A phase a person started (they moved or approved the card, or an agent in their session moved it) runs as that person, in every phase.
- A phase nobody started (a card from a webhook, an automatic phase, a rule) now runs as the Factory itself and uses the organization's model keys only. Before, it ran as whoever connected the repository.
- If no organization key is set, the run stops with a clear "add an organization key" message instead of retrying.
- Factories set to personal credentials have no keys of their own, so there such a phase runs as the person who created the Factory.

Sessions that already exist keep their owner.

**Approving a parked plan**

- The person who asked for the work, and anyone whose session follows the card, can approve or decline a parked plan from their own session in the sidebar, or with `factory_answer_approval`.
- The run then carries on as the phase session's owner. Before, it carried on as whoever answered, and could fail with "the request has no authenticated user".

**Sidebar**

A card's phase sessions now show under the session that asked for the work when child sessions are revealed, and that session shows "waiting on you" while one of them is parked.
