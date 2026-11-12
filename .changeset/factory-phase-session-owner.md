---
'@mastra/factory': patch
---

Fixed who owns the sessions a Factory card runs in, and who can approve what they wait on.

**Who owns a card's phase session**

- A phase a person started (they moved or approved the card, or an agent in their session moved it) runs as that person, in every phase.
- A phase nobody started (a card from a webhook, an automatic phase, a rule) now runs as the Factory itself and uses the organization's model keys only. Before, it ran as whoever connected the repository.
- If no organization key is set, the run stops with a clear "add an organization key" message and is not tried again on its own. Add the key, then press Retry on the card.
- Factories set to personal credentials have no keys of their own, so there such a phase runs as the person who created the Factory.

Sessions that already exist keep their owner.

**Approving a waiting tool call**

- The person who asked for the work, and anyone whose session follows the card, can approve or decline any tool call the phase session is waiting on, a plan or any other tool that asks first. They can do it from their own session in the sidebar, with `factory_answer_approval`, or over HTTP:

  ```http
  POST /web/user-sessions/:sessionId/parked-approval
  { "decision": "approve" }
  ```

  Add `toolCallId` when the session waits on more than one approval. Questions that need a typed answer are still answered in the session.

- The run then carries on as the phase session's owner. Before, it carried on as whoever answered, and could fail with "the request has no authenticated user".
- Following moves with a session: after a hand-over, the session's new owner can answer and the old one cannot.

**Sidebar**

A card's phase sessions now show under the session that asked for the work when child sessions are revealed, and that session shows "waiting on you", with Approve and Decline in its menu, while one of them waits on the viewer.
