# REST BOLA checker

`bola_rest_read` version 1 compares two accounts reading the same observed private resource. Its contract is defined in [`checker-contracts.ts`](../../src/investigation/checker-contracts.ts), with execution in [`bola-driver.ts`](../../src/investigation/bola-driver.ts).

## Required input

- An authorized `rest_api` target with a confirmed `GET` rule marked `user + owner`.
- Two current, ready API-key profiles with scan-bound `DISTINCT` account evidence.
- A resource observed through an account's own collection and detail links.

Sherlock selects from the supplied candidate IDs. It cannot provide a new URL, object ID, or checker.

## Execution and evidence

The verifier reserves at most two GET requests: owner and alternate account, for the same private path. The gateway validates scope, peer, and budgets before inserting credentials. Keys stay outside the verifier and model inputs.

Confirmation requires completed upstream HTTP 200 responses with equal private bodies, accepted by Dupin and Watson. An expected denial such as 403 yields `NOT_REPRODUCED`; incomplete proof or model disagreement yields `INCONCLUSIVE`. A model vote cannot turn a failed comparison into a confirmed finding.

Response bodies and digests stay in private memory. Persisted results contain statuses, equality, request accounting, and minimized references. Request and token reservations aren't refunded on failure. A confirmed finding and terminal assessment state are stored together after cleanup.

Use [the assessment walkthrough](../bola-assessment.md) to run this checker, or [the customization guide](../customization.md#route-rules-categories-and-checkers) to add another.
