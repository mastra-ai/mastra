# Customize providers

The default agent uses OpenAI and requires `OPENAI_API_KEY`. Document extraction stays on the local fixture by default, alongside fixture screening, local identity/address checks, local filesystem documents, local notifications and simulated provisioning.

Provider selection happens through `.env` and is validated before storage effects. Relevant selectors include:

- `DOCUMENT_EXTRACTION_PROVIDER` and `DOCUMENT_EXTRACTION_MODEL`;
- `IDENTITY_VERIFICATION_PROVIDER` and `ADDRESS_VERIFICATION_PROVIDER`;
- `SANCTIONS_SCREENING_PROVIDER` and `PEP_SCREENING_PROVIDER`;
- `DOCUMENT_STORAGE_PROVIDER`, `NOTIFICATION_PROVIDER` and `PROVISIONING_PROVIDER`;
- `RISK_ASSESSMENT_PROVIDER` and `RISK_ASSESSMENT_MODEL`.

The OpenAI agent uses the model-router identifier already registered by the template. External OpenAI document extraction additionally requires `openai-multimodal` in `KYC_EXTERNAL_PII_PROVIDER_ALLOWLIST`. OpenSanctions requires `OPENSANCTIONS_API_KEY` plus the exact selected adapter IDs in the same allowlist. Secrets are resolved only for selected adapters.

When replacing a provider, implement the corresponding contract under `src/contracts`, declare truthful capabilities, preserve typed safe errors and pass the contract kit. A timeout, unavailable provider or malformed result must never be interpreted as a clear check.

Review provider terms, privacy, retention, regional routing, credentials, budgets and license obligations before sending real data. The bundled live-smoke commands are synthetic, manually gated and intentionally outside CI.
