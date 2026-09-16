# Configuration

The quickstart needs only `OPENAI_API_KEY`. Every setting below is optional and can be added to `.env` when you need to change the local defaults or enable an integration.

## Runtime

The standalone template uses npm workspaces. Its Node.js requirement is `^22.22.0 || >=24.12.0`, as declared in [`package.json`](../package.json); use a supported LTS release within that range. The scripts use `--env-file-if-exists` and `import.meta.dirname`, so the template intentionally requires more than the Mastra CLI minimum. Run `npm install` from the template root to install both the backend and portal dependencies.

Mastra packages use `latest` according to the upstream template requirements. The monorepo's own pnpm setup applies to framework development; it does not replace the standalone template's npm commands.

## Environment variables

Configuration is read once by the app loader and validated with Zod. Domain, repository, provider, and workflow code do not read `process.env`. Defaults are local, file-backed, and resolved through stable registry identifiers.

| Variable                                          | Default                   | Purpose                                                                           |
| ------------------------------------------------- | ------------------------- | --------------------------------------------------------------------------------- |
| `APP_ENV`                                         | `demo-default`            | Selects `test`, `demo-default`, or `demo-strict` behavior                         |
| `HOST`                                            | `127.0.0.1`               | App bind address                                                                  |
| `PORT`                                            | `4111`                    | App port                                                                          |
| `PORTAL_ORIGIN`                                   | `http://127.0.0.1:5173`   | Exact allowed local portal origin                                                 |
| `OPENAPI_PATH`                                    | `/openapi.json`           | Public generated OpenAPI document path                                            |
| `DEMO_DATA_ROOT`                                  | `./data`                  | Strict containment root for destructive demo reset                                |
| `LIBSQL_DOMAIN_URL`                               | `file:./data/kyc.db`      | Operational LibSQL file URL                                                       |
| `LIBSQL_MASTRA_URL`                               | `file:./data/mastra.db`   | Mastra storage file URL                                                           |
| `DUCKDB_URL`                                      | `./data/analytics.duckdb` | DuckDB file path                                                                  |
| `STUDIO_PORT`                                     | `4112`                    | Studio port when using `npm run dev` or `npm run dev:studio`                      |
| `DEV_PORTAL_PORT`                                 | `5173`                    | Portal port for the combined development command                                  |
| `STUDIO_DATA_ROOT`                                | `./data/studio`           | Studio storage root; set to `./data` to share workflow runs with the API          |
| `STUDIO_ANALYTICS_PATH`                           | isolated automatically    | Studio DuckDB path; defaults below a `studio` subdirectory when storage is shared |
| `DOCUMENT_STORAGE_PATH`                           | `./data/documents`        | Reserved local document directory                                                 |
| `KYC_DEFAULT_TENANT_ID`                           | `demo`                    | Default trusted local tenant                                                      |
| `KYC_DEFAULT_JURISDICTION`                        | `US`                      | Demonstration jurisdiction                                                        |
| `KYC_DEFAULT_POLICY_PROFILE`                      | profile-dependent         | Default US policy profile                                                         |
| `KYC_PII_MODE`                                    | profile-dependent         | `demo-default` or `demo-strict`                                                   |
| `KYC_LOCALE`                                      | `en-US`                   | Default request locale                                                            |
| `KYC_EXTERNAL_PII_PROVIDER_ALLOWLIST`             | empty                     | Comma-separated strict-mode external allowlist                                    |
| `KYC_CUSTOMER_WEBHOOK_CURRENT_SECRET`             | unset                     | Current inbound customer HMAC secret                                              |
| `KYC_CUSTOMER_WEBHOOK_PREVIOUS_SECRET`            | unset                     | Previous inbound customer HMAC secret                                             |
| `KYC_COMPLIANCE_REVIEWER_WEBHOOK_CURRENT_SECRET`  | unset                     | Current inbound reviewer HMAC secret                                              |
| `KYC_COMPLIANCE_REVIEWER_WEBHOOK_PREVIOUS_SECRET` | unset                     | Previous inbound reviewer HMAC secret                                             |
| `KYC_COMPLIANCE_SENIOR_WEBHOOK_CURRENT_SECRET`    | unset                     | Current inbound senior-reviewer HMAC secret                                       |
| `KYC_COMPLIANCE_SENIOR_WEBHOOK_PREVIOUS_SECRET`   | unset                     | Previous inbound senior-reviewer HMAC secret                                      |
| `KYC_OUTBOUND_WEBHOOK_CURRENT_SECRET`             | unset                     | Current outbound notification HMAC secret                                         |
| `KYC_OUTBOUND_WEBHOOK_PREVIOUS_SECRET`            | unset                     | Reserved previous outbound HMAC key                                               |
| `KYC_OUTBOUND_WEBHOOK_URL`                        | unset                     | Explicit opt-in outbound endpoint                                                 |
| `DOCUMENT_EXTRACTION_PROVIDER`                    | `fixture`                 | Credential-free extraction selection                                              |
| `DOCUMENT_EXTRACTION_MODEL`                       | `fixture`                 | Model capability descriptor                                                       |
| `OPENAI_EXTRACTION_INPUT_USD_PER_MILLION`         | `0.2`                     | Versioned input-unit price assumption                                             |
| `OPENAI_EXTRACTION_OUTPUT_USD_PER_MILLION`        | `1.2`                     | Versioned output-unit price assumption                                            |
| `OPENAI_EXTRACTION_PRICE_VERSION`                 | dated approved identifier | Price assumption version stored with each priced fact                             |
| `KYC_AGENT_MODEL`                                 | `openai-gpt-5.6-luna`     | Agent model descriptor                                                            |
| `OPENAI_API_KEY`                                  | unset                     | OpenAI credential; presence is retained, value is not                             |
| `OPENSANCTIONS_API_KEY`                           | unset                     | OpenSanctions secret; resolved only for selected adapters                         |
| `IDENTITY_VERIFICATION_PROVIDER`                  | `local-identity`          | Identity verification selection                                                   |
| `ADDRESS_VERIFICATION_PROVIDER`                   | `local-address`           | Address verification selection                                                    |
| `SANCTIONS_SCREENING_PROVIDER`                    | `fixture-sanctions`       | Sanctions screening selection                                                     |
| `PEP_SCREENING_PROVIDER`                          | `fixture-pep`             | PEP screening selection                                                           |
| `DOCUMENT_STORAGE_PROVIDER`                       | `local-filesystem`        | Document-byte storage selection                                                   |
| `NOTIFICATION_PROVIDER`                           | `local-inbox`             | Persisted notification selection                                                  |
| `WEBHOOK_PUBLISHER`                               | `capture`                 | Local webhook capture selection                                                   |
| `PROVISIONING_PROVIDER`                           | `simulated`               | Simulated account selection                                                       |
| `RISK_POLICY_PROVIDER`                            | profile-dependent         | Deterministic risk-policy selection                                               |
| `RISK_ASSESSMENT_PROVIDER`                        | `rule-based`              | Offline or structured narrative provider                                          |
| `RISK_ASSESSMENT_MODEL`                           | `openai-gpt-5.6-luna`     | Structured narrative model descriptor                                             |
| `PROVIDER_TIMEOUT_MS`                             | `10000`                   | Caller timeout budget                                                             |
| `PROVIDER_MAX_ATTEMPTS`                           | `3`                       | Bounded later workflow attempts                                                   |
| `PROVIDER_RETRY_BASE_DELAY_MS`                    | `100`                     | Bounded later retry base delay                                                    |
| `VITE_API_BASE_URL`                               | `http://127.0.0.1:4111`   | Portal API origin                                                                 |

The local registry accepts only the IDs shown above. Configuration parsing permits a provider-neutral string, then startup validates the selected ID, required capability, model capability, jurisdiction/profile, and risk policy before initializing storage or constructing providers. Unknown IDs, duplicate registrations, unavailable capabilities, and missing selected-provider configuration fail with safe messages that never print secret values.

`APP_ENV=demo-strict` selects `demo-strict` policy, PII, and risk-policy defaults. Explicit weaker selections are rejected instead of silently downgrading the profile. Validated configuration is deeply immutable, including provider selections and PII allowlists. Unknown-key detection applies only to exact scalar keys and owned namespaces, so unrelated host variables such as `HOSTNAME` are ignored while misspelled `RISK_*` settings fail startup.

Registry factories are lazy. Customer TODO examples are deliberately absent, so their identifiers cannot be selected accidentally. `fixture` is the credential-free extraction selection. `openai-multimodal` is registered for explicit use in `demo-default` or `demo-strict`; it fails startup without `OPENAI_API_KEY`. `opensanctions-sanctions` and `opensanctions-pep` are independent opt-in selections backed by one native HTTP gateway. Each selected adapter requires `OPENSANCTIONS_API_KEY` and its own exact ID in `KYC_EXTERNAL_PII_PROVIDER_ALLOWLIST`. The secret resolver is not called for fixture defaults, resolves once for an explicit selection, and keeps the value out of enumerable dependency/configuration surfaces. The complete `live` profile remains unavailable because production identity and address providers are not implemented. Setting an unregistered provider fails during startup before storage effects.

Inbound webhook keys fall back to process-local synthetic test/demo material only outside `live`; production-like configuration must supply current secrets of at least 32 characters. Previous secrets are optional rotation keys. Outbound delivery remains disabled unless both `KYC_OUTBOUND_WEBHOOK_URL` and `KYC_OUTBOUND_WEBHOOK_CURRENT_SECRET` are present. Secret values stay outside validated enumerable configuration; it retains only configured booleans and the outbound URL.

`demo-strict` denies external PII transmission unless the provider is explicitly allowlisted. OpenSanctions requires explicit allowlisting in both demo modes. An allowlist is only permission to reach an adapter boundary; it is not approval of provider privacy, retention, data-processing, licensing, cost, or regional terms.

Extraction prompt, schema, model, and quality policy versions are separate. `DOCUMENT_EXTRACTION_MODEL=fixture` describes the local provider result. The real selection is `DOCUMENT_EXTRACTION_PROVIDER=openai-multimodal` with `DOCUMENT_EXTRACTION_MODEL=openai-gpt-5.6-luna`; the model registry maps that stable internal ID to Mastra's `openai/gpt-5.6-luna` runtime ID. Document content transmission also requires `KYC_EXTERNAL_PII_PROVIDER_ALLOWLIST=openai-multimodal` in either PII mode.

The default `kycOnboardingAgent` uses `KYC_AGENT_MODEL=openai-gpt-5.6-luna`. Tests and offline verification explicitly override it with the code-local deterministic fixture. The agent tool receives tenant, jurisdiction, PII profile, locale, and policy from the same trusted configuration above. Model selection does not change the workflow's authority over state or policy and is not required to use real document extraction.

`RISK_ASSESSMENT_PROVIDER=structured-llm` requires `RISK_ASSESSMENT_MODEL=openai-gpt-5.6-luna` and an OpenAI credential. It receives only redacted factor codes, weights, score, level, route, policy reference, and evidence fingerprint. The deterministic risk policy remains authoritative; invalid or unavailable narrative output is ignored.

The real adapter uses the OpenAI API through Mastra's model router, requests schema-constrained output, disables model retries, limits output tokens, hides input/output from tracing, and persists only redacted token, cost, and latency facts. The API key is read by the provider runtime; validated application configuration retains only a boolean indicating presence.

The extraction price inputs are validated non-negative USD-per-million assumptions and are not fetched at runtime. Update both values and the version together after a pricing review. Provider usage is required for priced facts; an unpriced operation remains explicit instead of guessing units or cost.

OpenSanctions uses `POST /match/default` with `logic-v2`, limit 5, and distinct sanctions (`sanction`, `sanction.linked`, `debarment`) and PEP (`role.pep`, `role.rca`) topics. A valid score below `0.70` is clear, `0.70` through below `0.85` is a possible match, and `0.85` or above is a strong review candidate. Automatic retry is capped at one and applies only to HTTP 502/503/504 while deadline remains; 429, timeout, transport ambiguity, 4xx, and malformed results are not retried.

The live smoke is deliberately outside CI. It requires `OPENSANCTIONS_LIVE_GATE_ACCEPTED=contract-privacy-license-approved-2026-08-21`, `OPENSANCTIONS_CAMPAIGN_REQUEST_LIMIT=50`, `OPENSANCTIONS_MAX_BUDGET_EUR=0.2`, the API key, and the ignored local campaign ledger described in [OpenSanctions screening](opensanctions.md). It atomically reserves exactly two calls before network access, uses no retry, accepts only the documented synthetic identity, and prints only redacted status/count/budget summaries. Do not set the gate or initialize/reset its ledger until the external contract, license, privacy, retention, regional, credential, and budget review is accepted.

Copy `.env.example` to `.env` for local overrides. Never commit `.env` files or credentials.
