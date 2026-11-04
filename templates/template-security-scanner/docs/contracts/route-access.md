# Route access rules

A version 1 route rule identifies one exact method and canonical path template, its source, expected unauthorized HTTP statuses and intended audience: `public`, `user` or `admin`. A `user` rule additionally specifies `owner` or `shared` object policy. Operator-confirmed rules carry the current operator revision. OpenAPI suggestions do not authorize a checker. Excluded paths and target scope still take precedence.

For the Orders API, confirm `GET /api/orders`, `GET /api/orders/{id}` and `GET /api/orders/{id}/receipt` as `user + owner`. Set the public `GET /api/products` rule to `public`; its response is shared by A, B and an anonymous caller. The example has no admin route. A public or shared response is not a BOLA result, and an `admin` rule does not enter the owner-object checker.

The operator supplies the expected policy. The scanner observes actual account-specific collections and details; Sherlock selects an eligible observed relation. A `user + owner` label by itself is insufficient proof. Confirmation requires a bounded cross-account read of the same private object with equal upstream response evidence. For a protected route, an expected 403 produces `NOT_REPRODUCED` without a finding. See [`route-access.ts`](../../src/core/route-access.ts), [the checker contract](checkers.md) and [the console journey](../console-scan.md).
