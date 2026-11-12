---
'@mastra/factory': patch
---

Fixed who owns the sessions a Factory card runs in, and who can approve what they wait on.

**Who owns a card's phase session**

- In a Factory that runs card work on the organization's model keys (the `factory` and `hybrid` credential settings), every new phase session now belongs to the Factory itself and uses the organization's keys and the Factory's default model. That holds whoever moved the card: a person, an agent, a webhook or a rule. Before, it ran as whoever connected the repository, or as the person who approved the move.
- The person who moved or approved the card stays on record as the one who did it. When they move a card from their own session, that session follows the card, so it hears when the phase waits on someone and can answer from there.
- If no organization key is set, the run stops with a clear "add an organization key" message and is not tried again on its own. Add the key, then press Retry on the card.
- In a Factory on personal credentials there are no organization keys, so a phase runs as the person who moved or approved the card (or whose session's agent moved it), and otherwise as the person who created the Factory.

Sessions that already exist keep their owner.

**Approving a waiting tool call**

- The person who asked for the work, and anyone whose session follows the card, can approve or decline any tool call the phase session is waiting on, a plan or any other tool that asks first. They can do it from their own session in the sidebar, with `factory_answer_approval`, or over HTTP:

  ```http
  POST /web/user-sessions/:sessionId/parked-approval
  { "decision": "approve" }
  ```

  Add `toolCallId` when the session waits on more than one approval. Questions that need a typed answer are still answered in the session.

- A session following the card is told when the phase session waits on a yes or no, for a plan or any other tool, with the call to answer it.
- The run then carries on as the phase session's owner. Before, it carried on as whoever answered, and could fail with "the request has no authenticated user".
- Following moves with a session: after a hand-over, the session's new owner can answer and the old one cannot.

**Sidebar**

A card's phase sessions now show under the session that asked for the work when child sessions are revealed, marked "run by Factory" when the Factory owns them, and that session shows "waiting on you", with Approve and Decline in its menu, while one of them waits on the viewer.
