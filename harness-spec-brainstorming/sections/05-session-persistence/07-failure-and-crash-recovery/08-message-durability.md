### 5.7h Message Durability

**`message` pre-acceptance durability is intentionally absent.** The harness
does not record a durable queue row for the *unaccepted* `message` item itself
— persisting interactive `message` items would defeat the Slack semantic.
Multiple concurrent users sending messages should not produce a recoverable
backlog; they produce live inputs into the conversation. If a caller wants
*pre-acceptance* survival across restarts, they use `queue(...)`.

Post-acceptance, the agent-layer signal boundary in §5.7d still owns
durability for every accepted `message(...)` and every drained `queue(...)`:
terminal settlement is by `signalId` through `message_completed` /
`message_failed` (or the message-result lookup route), and retained
`OperationAdmissionTombstone` evidence supports exact `admissionId` retry
de-dupe per §15.1 "Direct interactive `message(...)`". The Slack-semantic
exemption applies only to the pre-acceptance window; it does not extend the
§5.7d post-acceptance boundary and it does not promise de-dupe survival once
the compact tombstone expires.

**What this buys us.**

- A laptop tab and a phone tab pointing at the same session see consistent state
because both go through `harness.session({ sessionId })` and both hit the same
record.
- An OS-level kill of the server doesn't lose pending approvals, queued
messages, or in-flight tool suspensions. The next process boot answers
`harness.session(...)` calls from storage and the user picks up where they left
off.
- Tools and clients don't have to model "is this a fresh session or a resumed
one" — the contract is the same either way.
