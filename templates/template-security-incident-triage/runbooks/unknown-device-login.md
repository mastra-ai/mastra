---
id: RB-IDENTITY-003
version: 1.0.0
incidentKinds:
  - unknown_device_login
owner: security
status: active
mandatoryRules:
  - Invalid signatures or missing required evidence require manual review rather than automatic conclusions.
  - A `soc_manager` must approve the exact structured plan, session, device ID, subject, impact, rollback, expiration, and plan hash before either allowed action.
---

## Purpose and Preconditions

Incident kind: `unknown_device_login`. Investigate a valid login using an application-issued device identifier absent from the tenant's authorized-device list. Confirm tenant, subject, session, and signed identifier before using this procedure.

## Signals and Known False Positives

Signals include a new signed device ID, a new session, or unusual recent access. Known false positives include cookie deletion, browser reset, device replacement, or delayed authorized-device synchronization.

## Required and Optional Evidence

Required evidence is the device identifier, valid application signature, tenant-scoped authorized-device list, explicit session, and recent login history. Optional evidence includes user-confirmed replacement context. A missing cookie is not proof of attack.

## Severity Rules

Treat an unknown signed device plus abnormal session history as high concern. Reduce confidence for a documented device replacement. Invalid signatures or missing required evidence require manual review rather than automatic conclusions.

## Investigation

Verify the application signature, compare the device ID to the tenant and subject allowlist, inspect the scoped session, and review recent logins. Do not perform invasive fingerprinting or infer a person's identity outside the application.

## Allowed and Prohibited Actions

### Allowed

- `revoke_session`: Revoke only the explicitly identified session after approval.
- `mark_device_for_review`: Mark only the scoped device identifier for human review after approval.

### Prohibited

- `elevate_account`: Never elevate or alter account privileges.
- `delete_account`: Never delete the affected account.
- `revoke_all_tenant_sessions`: Never perform a tenant-wide or global revocation.
- `fingerprint_device`: Never perform invasive browser or device fingerprinting.
- `bypass_approval`: Never bypass the required human decision.
- `generic_tool`: Never invoke generic HTTP, shell, SQL, or code execution.

## Approval Requirements

A `soc_manager` must approve the exact structured plan, session, device ID, subject, impact, rollback, expiration, and plan hash before either allowed action.

## Post-Containment Validation

Verify the scoped session is revoked, the intended device is marked for review, and no unrelated device or subject changed. Persist provider results by reference.

## Rollback and Escalation

If the device is later verified, a separate authenticated review may clear its review marker. Session revocation is not reversible, and any new session must complete normal authentication.
