# Assess the Orders API

Broken object-level authorization (BOLA) lets one account access another account's private object. This walkthrough compares two accounts against the included [Orders API](example-target.md).

Complete the [quickstart](../README.md#quickstart-) first, including Morph configuration. Keep `npm run example-target` and `npm run dev` running in separate terminals.

## Register the target

1. In **Policies**, create a policy permitting GET and HEAD. Set request and duration limits, evidence-retention days, and an approver.
2. In **Targets**, create a **REST API** target with environment **Lab**. Append `/api/orders` to the printed `scannerUrl` for the entry URL and use `openApiUrl` for OpenAPI. Set the approved origin to `scannerUrl`. Allow `/api` and `/openapi.json` on separate lines, then confirm methods and authorization.
3. Review the route table and confirm these rules:

| GET route                  | Audience | Object policy  |
| -------------------------- | -------- | -------------- |
| `/api/orders`              | User     | Owner only     |
| `/api/orders/{id}`         | User     | Owner only     |
| `/api/orders/{id}/receipt` | User     | Owner only     |
| `/api/products`            | Public   | Not applicable |

OpenAPI suggests routes; your confirmation supplies the intended access policy.

## Add the two accounts

Add an **API key header** profile for each printed user, A and B. Use these settings for both:

| Field                           | Value                       |
| ------------------------------- | --------------------------- |
| Header                          | `x-api-key`                 |
| Credential                      | That user's printed API key |
| Access-check path               | `/api/orders`               |
| Account identifier JSON pointer | `/principal`                |

Choose **Check identity** for both profiles after the last edit. Each must be `READY` at the current target revision.

For your own API, the pointer must select a stable account ID string from the access-check response. Both profiles must use the same origin, path, and pointer. Different keys or profile names don't prove different accounts. Missing or equal account IDs produce `INCONCLUSIVE` before model calls or verification. The runtime stores only the comparison `SAME`, `DISTINCT`, or `UNKNOWN`, not the extracted account IDs.

## Run and read the result

Choose **Start REST assessment**. Discovery follows observed owner-only links. Sherlock selects a candidate, the verifier compares the owner's and alternate account's reads, Dupin interprets the proof, and Watson reviews a proposed positive.

In **Scans**, inspect the selected route, response statuses, comparison, request/token reservations, and cleanup:

| Outcome          | Meaning                                                                                                                                 |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `CONFIRMED`      | Both accounts received the same private response, and the model reviews accepted the proof. A REST BOLA record appears in **Findings**. |
| `NOT_REPRODUCED` | The completed comparison found an expected protected response, such as 403. No new finding is created.                                  |
| `INCONCLUSIVE`   | Account evidence or comparison is incomplete, or a model review disagreed. Inspect the reason before retrying.                          |

Public and shared routes are excluded. You don't supply or guess an object ID. See the [checker contract](contracts/checkers.md) for the exact confirmation boundary.

## Compare protected behavior

Stop both processes with Ctrl+C. Start `npm run example-target -- --mode=protected`, then restart `npm run dev` so it reads the new Docker connection. Register the target using the newly printed URLs and the same seeded accounts, check both identities, and repeat the assessment. Cross-account detail reads now return 403. Earlier findings stay in history.

You can cancel an active assessment from **Scans**. Cleanup must finish before cancellation is complete; `DEBT` indicates cleanup that will be retried after restart. Retention removes expired candidate paths and proof while preserving the outcome and a reduced finding. Raw bodies, keys, and response digests aren't stored or sent to models; retained inventory paths can contain identifiers.
