---
id: RB-IDENTITY-001
version: 1.0.0
incidentKinds:
  - unauthorized_privilege_change
owner: security
status: active
mandatoryRules:
  - Missing required evidence requires manual review.
  - A `soc_manager` must approve the exact structured plan, target, previous role, session identifiers, impact, rollback, expiration, and plan hash before any allowed action.
---

## Purpose and Preconditions

Incident kind: `unauthorized_privilege_change`. Investigate a customer role change that was not matched to an approved administrative process. Confirm tenant and subject identifiers before using this procedure.

## Signals and Known False Positives

Signals include a transition from `member` to `admin`, an unexpected actor, or a change outside an approved window. Known false positives include a delayed approval record, an authorized break-glass exercise, or a harmless synchronization retry.

## Required and Optional Evidence

Required evidence is the previous identity snapshot, the current role-change event, the actor identifier, tenant scope, and the event time. Optional evidence includes active sessions and nearby administrative events. Missing required evidence requires manual review.

## Severity Rules

Treat an unapproved administrative role with active sessions as high concern. Reduce confidence when the previous snapshot or approval record is unavailable. Do not infer compromise solely from the new role.

## Investigation

Compare the prior and current roles, verify the actor and tenant, search the approved-change window, and enumerate only the subject's active sessions. Record contradictions and missing evidence without inventing a resolution.

## Allowed and Prohibited Actions

### Allowed

- `restore_previous_role`: Restore only the previously persisted role after approval.
- `revoke_session`: Revoke explicitly identified sessions after approval.

### Prohibited

- `elevate_account`: Never elevate or assign a new role from this runbook.
- `delete_account`: Never delete the affected account.
- `revoke_all_tenant_sessions`: Never perform a tenant-wide or global revocation.
- `change_identity_policy`: Never alter arbitrary identity policy.
- `bypass_approval`: Never bypass the required human decision.
- `generic_tool`: Never invoke generic HTTP, shell, SQL, or code execution.

## Approval Requirements

A `soc_manager` must approve the exact structured plan, target, previous role, session identifiers, impact, rollback, expiration, and plan hash before any allowed action.

## Post-Containment Validation

Verify the current role equals the preserved previous role, the approved sessions are no longer active, and no unrelated subject or tenant was modified. Persist provider results by reference.

## Rollback and Escalation

If restoration produces an unexpected role, stop further actions and escalate for manual identity administration. A new approved plan is required for any corrective change; do not reuse the prior approval.
