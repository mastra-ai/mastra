---
id: RB-IDENTITY-002
version: 1.0.0
incidentKinds:
  - disallowed_country_login
owner: security
status: active
mandatoryRules:
  - Missing policy or session evidence requires manual review.
  - A `soc_manager` must approve the exact structured plan, session, subject, impact, rollback, expiration, and plan hash.
---

## Purpose and Preconditions

Incident kind: `disallowed_country_login`. Investigate a login whose normalized country is outside the tenant's allowlist. Confirm tenant, subject, session, policy version, and observation time before using this procedure.

## Signals and Known False Positives

Signals include a country outside `US`, a new network, or nearby suspicious session activity. Known false positives include corporate VPN egress, mobile carrier routing, provider geolocation drift, and an approved travel exception.

## Required and Optional Evidence

Required evidence is the source IP reference, GeoIP result with timestamp and confidence, tenant country policy, explicit session, and recent login history. Optional evidence includes ASN or network category. GeoIP alone is not proof of compromise.

## Severity Rules

Treat a disallowed country plus abnormal session history as high concern. Reduce confidence for known VPN or low-confidence GeoIP results. Missing policy or session evidence requires manual review.

## Investigation

Validate the policy version, compare the country result to the allowlist, inspect the scoped session and recent history, and document VPN or travel explanations. Never broaden the query to other tenants.

## Allowed and Prohibited Actions

### Allowed

- `revoke_session`: Revoke only the explicitly identified session after approval.
- `require_reauthentication`: Require reauthentication only for the scoped subject after approval.

### Prohibited

- `elevate_account`: Never elevate or alter account privileges.
- `delete_account`: Never delete the affected account.
- `revoke_all_tenant_sessions`: Never perform a tenant-wide or global revocation.
- `change_geo_policy`: Never alter arbitrary country or network policy.
- `bypass_approval`: Never bypass the required human decision.
- `generic_tool`: Never invoke generic HTTP, shell, SQL, or code execution.

## Approval Requirements

A `soc_manager` must approve the exact structured plan, session, subject, impact, rollback, expiration, and plan hash. A country signal never creates standing approval.

## Post-Containment Validation

Verify the scoped session is revoked, reauthentication is required only for the approved subject, and unrelated sessions remain unchanged. Persist provider results by reference.

## Rollback and Escalation

If the signal is explained by approved travel or provider error, stop and escalate for policy review. Session revocation is not reversible; any access restoration follows a separate authenticated process.
