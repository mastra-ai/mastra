---
'@internal/mastra-factory': patch
---

Re-review a pull request when a push lands while its card is still in Reviewing.

A push to a card already sitting in Reviewing was dropped rather than deferred:
the rule returned nothing, and once the in-flight pass finished it transitioned
to Done having reviewed code that was no longer current, with no record that
newer commits had arrived. That is the exact ordering the review loop produces —
a review asks for changes, the authoring agent pushes a fix, and the fix lands
before the card finishes leaving Reviewing.

Only Intake now suppresses the re-review. A push during Reviewing re-enters the
stage, which supersedes the stale pass: the stage rule already cancels the run
in flight and selects the right skill for the entry it sees.

Transition decisions carry a `reenter` flag for this, since a transition to the
stage an item already holds is otherwise inert — the common case is a board
being corrected into a state it already has, not work that needs restarting.
