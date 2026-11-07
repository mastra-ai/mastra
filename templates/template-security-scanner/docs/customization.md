# Customize the scanner

Start with configuration when you want different scopes, accounts, budgets, retention, or advisory schedules. Those settings belong in the console or [configuration](configuration.md), without a code change.

For product changes, use this map:

| Change                                   | Start here                                                                                  |
| ---------------------------------------- | ------------------------------------------------------------------------------------------- |
| Agent instructions                       | [`src/mastra/agents/investigation-agents.ts`](../src/mastra/agents/investigation-agents.ts) |
| Model configuration and runtime defaults | [`src/config/settings.ts`](../src/config/settings.ts)                                       |
| REST observations and link traversal     | [`src/discovery/rest.ts`](../src/discovery/rest.ts)                                         |
| Target and authentication contracts      | [`src/core/`](../src/core/)                                                                 |
| Finding categories and checkers          | [`src/investigation/`](../src/investigation/)                                               |
| Offline playbooks                        | [`src/knowledge/playbooks.ts`](../src/knowledge/playbooks.ts)                               |
| CVE import and triage                    | [`src/advisory/`](../src/advisory/)                                                         |
| Console views                            | [`web/`](../web/)                                                                           |
| Example routes and data                  | [`example-target-api/`](../example-target-api/)                                             |

## Agents and models

Nemo summarizes inventory, Sherlock proposes grounded hypotheses, Dupin interprets fixed evidence, and Watson independently reviews proposed confirmations. Their instructions live together; [`bola-models.ts`](../src/investigation/bola-models.ts) defines the REST-specific inputs and outputs.

To change a model, update the validated settings and `morphModelDescriptor` in [`settings.ts`](../src/config/settings.ts). A new provider also needs compatible structured output, credentials, and token accounting. Test the generated requests and rejected responses before using live calls.

Keep model choices separate from execution authority. Prompts cannot add requests, change target scope, or confirm a finding without the required evidence.

## Application and authentication drivers

The executable application driver is `rest_api` with `observed_json` and optional `openapi` discovery. Its reader follows observed `href` and detail `*Href` links that match confirmed routes. It doesn't guess object IDs. To support a different API response shape, start in [`rest.ts`](../src/discovery/rest.ts).

For a new driver:

1. Define its versioned input and observation schemas in [`application-drivers.ts`](../src/core/application-drivers.ts).
2. Connect an executor through the discovery service and gateway.
3. Verify real allowed and rejected traffic, bounded output, cancellation, and cleanup before making it available.

The `spa`, `fullstack`, and `graphql` catalog entries have no executable application driver. Website HTTP/headless discovery is a separate existing path.

REST authentication uses `api_key_header`. Extend [`authentication-drivers.ts`](../src/core/authentication-drivers.ts) together with credential registration, access checks, and gateway injection. Define origin binding, expiry, and refresh behavior. The `login_password`, `browser_session`, and `mfa_sso` entries are unsupported.

Credentials belong in trusted registration and gateway code. Preserve origin/path/method checks, DNS and peer validation, budgets, and sanitized exports when adding execution paths.

## Route rules, categories, and checkers

[`route-access.ts`](../src/core/route-access.ts) defines the access policy for an exact method and path template. Rules distinguish public, admin, and user access; user routes additionally distinguish owner-only and shared objects. OpenAPI suggestions require operator confirmation.

[`category-contracts.ts`](../src/investigation/category-contracts.ts) defines category IDs, evidence requirements, outcomes, and permitted checkers. [`checker-contracts.ts`](../src/investigation/checker-contracts.ts) describes executable checks. Adding catalog metadata alone doesn't register an executor.

Use [`bola_rest_read`](contracts/checkers.md) as the working REST example: a typed observed-resource input, two bounded reads, and deterministic comparison before model review. A new checker needs positive, protected, and incomplete-response cases through its real execution path. Arbitrary tools, external scripts, and runbooks have no executor.

Keep `bola` separate from the historical lab `idor` ID so existing findings retain their meaning. Other playbook categories run in the owned lab; catalog presence doesn't enable them against external APIs.

## API and console changes

Add protected routes under [`src/http/`](../src/http/) using the existing Hono integration and domain services. Preserve sessions, same-origin checks, CSRF, current revisions, and owner isolation.

Console views live in `web/` and use [`web/api.ts`](../web/api.ts). Reuse persisted operation states for progress and errors. Choose the relevant [tests](testing.md) for each change. Bundled references include integrity metadata and licenses; treat an update as a catalog change rather than editing them as prose documentation.
