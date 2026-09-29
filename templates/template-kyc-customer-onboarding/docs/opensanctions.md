# OpenSanctions screening

OpenSanctions is an explicit opt-in screening adapter. The credential-free fixture remains the default for local development, automated tests, and the Studio journey. This integration is a reference boundary, not a certified screening product or authorization to process real-person data.

## Matching policy and separation

The gateway uses `POST /match/default`, never the generic search endpoint. Sanctions and PEP are separate logical queries, adapters, workflow steps, results, evidence, and replay keys even though they share one native HTTP transport.

The versioned demonstration policy pins:

| Check     | Topics                                     | Algorithm  | Limit | Possible  | Strong review |
| --------- | ------------------------------------------ | ---------- | ----- | --------- | ------------- |
| Sanctions | `sanction`, `sanction.linked`, `debarment` | `logic-v2` | 5     | `>= 0.70` | `>= 0.85`     |
| PEP       | `role.pep`, `role.rca`                     | `logic-v2` | 5     | `>= 0.70` | `>= 0.85`     |

A score is matching confidence, not identity confirmation or a risk score. A valid response below `0.70` produces `CLEAR`; `0.70` through below `0.85` produces `POSSIBLE_MATCH`; `0.85` or above produces `STRONG_CANDIDATE`. A material match remains a candidate for later policy and human review and does not approve or reject a case.

## Request and domain mapping

The adapter sends only full name, permitted aliases, date of birth, and nationality. Its capability metadata declares identity, date-of-birth, and screening PII before the policy boundary. Name and date of birth are never placed in a URL, replay key, ledger, evidence envelope, log, trace, cost record, or analytics payload.

The provider response is runtime-validated before mapping. The domain retains only candidate ID, score, scoped topics, datasets, classification, provider ID/version, reason codes, and completion time. Candidate captions and raw provider request/response objects do not cross the adapter boundary. A sanctions adapter returning a PEP result, or vice versa, is rejected as `PROVIDER_RESULT_INVALID`.

Every successful check creates one evidence envelope. A clear result uses neutral `SANCTIONS_CHECK` or `PEP_CHECK` evidence. `SANCTIONS_CANDIDATE` and `PEP_CANDIDATE` are used only when a material candidate exists. Provider failures use `PROVIDER_UNAVAILABLE`; they never become clear.

## Failure, retry, and replay behavior

HTTP 400/422 maps to rejected input, 401/403 to misconfiguration, 429 to rate limiting, abort/deadline expiry to timeout, 502/503/504 and transport failures to unavailability, and malformed or out-of-scope responses to invalid result. Automatic retry is limited to one retry for 502/503/504 while deadline remains. The adapter does not retry 429, ambiguous transport failure, timeout, other 4xx responses, or invalid results. The live smoke disables retry entirely.

Check execution reserves an atomic tenant-qualified idempotency record before invoking a provider. Only the caller that acquires the reservation may make the external call. Concurrent followers wait for and replay the completed result. A stale incomplete reservation becomes inconclusive without another potentially billable request. Keys bind tenant, case, run, check, policy, provider/version, dataset, and algorithm and contain no PII in clear text. There is no cross-case or cross-run screening cache.

## Configuration and credential boundary

Select `opensanctions-sanctions` and/or `opensanctions-pep`, set `OPENSANCTIONS_API_KEY`, and add each selected ID to `KYC_EXTERNAL_PII_PROVIDER_ALLOWLIST`. The runtime secret resolver is not called for fixture defaults. For an explicit OpenSanctions selection it is called once before storage initialization; a missing credential fails startup before storage or network access. The secret is held in a non-enumerable private gateway field and is not retained in validated application configuration.

Allowlisting permits the adapter boundary only. It does not accept account, license, privacy, retention, regional, budget, or production-use terms.

## Manual live smoke and campaign ledger

The smoke is manual and outside CI. It is restricted to the bundled synthetic `Morgan Example`, date of birth `1990-01-01`, nationality `US`, exactly one sanctions query and one PEP query, zero retry, and EUR 0.20 per run.

Required environment values are:

- `OPENSANCTIONS_LIVE_GATE_ACCEPTED=contract-privacy-license-approved-2026-08-21`
- `OPENSANCTIONS_CAMPAIGN_REQUEST_LIMIT=50`
- `OPENSANCTIONS_MAX_BUDGET_EUR=0.2`
- `OPENSANCTIONS_API_KEY`

The ignored local file `data/opensanctions-campaign-ledger.json` is the workspace-scoped campaign guard. It stores only version, campaign identifier, limit, reserved request count, and update time. The script obtains an exclusive lock and reserves both requests before network access. Reservations are not rolled back after partial or ambiguous failure because either request may have been billed. A missing, invalid, locked, or exhausted ledger fails before the provider call.

On the first authorized run in a workspace, set `OPENSANCTIONS_CAMPAIGN_INITIAL_USED` to the independently audited number of requests already consumed. Do not guess or reset it to regain capacity. Later runs omit that variable and reuse the local ledger. The ledger coordinates this workspace only; coordinating several machines requires a separately approved shared counter.

The command emits only gate/budget counters plus sanctions and PEP status/candidate counts. It does not persist the credential, identity, query, candidate caption, or raw response.

## Terms and operational limits

Use requires the appropriate OpenSanctions account and commercial rights. The customer remains responsible for lawful processing and decisions; the template does not authorize redistribution, sublicensing, bulk data, yente/on-prem deployment, production screening, or real-person inputs. Review the current primary sources before each contractual or production decision:

- [Matching API](https://www.opensanctions.org/docs/api/matching/)
- [Request and scoping](https://www.opensanctions.org/docs/api/request/)
- [Response format](https://www.opensanctions.org/docs/api/response/)
- [Authentication](https://www.opensanctions.org/docs/api/authentication/)
- [API and pricing](https://www.opensanctions.org/api/)
- [API terms](https://www.opensanctions.org/docs/terms/api/202509/)
- [Commercial use](https://www.opensanctions.org/faq/basics/commercial-use/)
