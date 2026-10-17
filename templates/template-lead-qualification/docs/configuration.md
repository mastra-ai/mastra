# Intake configuration

Edit the schema-validated `intakeConfig` in `src/mastra/config/intake.ts`. Restart after changing configuration. Preserve existing source and destination bindings until pending work completes; accepted events retain their original bindings and cannot silently switch destination.

| Setting                        | Default         | Meaning                                                           |
| ------------------------------ | --------------- | ----------------------------------------------------------------- |
| `source.id`                    | `local-inbound` | Trusted provenance and delivery-identity namespace                |
| `source.inputProviderId`       | `generic`       | Registered event input adapter                                    |
| `source.destinationProviderId` | `local`         | Explicit output destination binding; intake does not write output |
| `source.crmProviderIds`        | `["attio"]`     | CRM reference namespaces accepted without API access              |
| `limits.maxBodyBytes`          | 262144          | Maximum request size in bytes, up to 256 KiB                      |
| `limits.maxPendingRuns`        | 100             | Maximum accepted/dispatching associations; 1–1000                 |
| `limits.activeRuns`            | 2               | Concurrent dispatches; 1–2                                        |
| `limits.dispatchIntervalMs`    | 250             | Pending-work polling interval in milliseconds; 10–60000           |

Use a lower pending limit to bound the backlog. Increase it within the schema when the process can drain more accepted work; it does not increase concurrent dispatches. Duplicate delivery is checked before capacity. Increasing the interval reduces polling frequency and increases intake-to-dispatch latency. These limits govern intake only. There are no research, scoring or model-budget settings yet.

Runtime mode is independent of provider selection. `.env` defaults `LEAD_QUALIFICATION_MODE=local`, binding to `127.0.0.1`. Production binds to `0.0.0.0` and requires `LEAD_QUALIFICATION_TOKEN` with at least 32 characters. Use a random secret, supply it through your deployment's secret configuration, and terminate HTTPS at ingress. Requests cannot change mode. Production uses the same SimpleAuth for native API and Studio access, including requests carrying Studio routing headers. Supply `Authorization: Bearer <token>` to custom and native APIs; Studio supports token sign-in.

`MASTRA_TELEMETRY_DISABLED=1` disables CLI usage telemetry. Application observability still uses the local DuckDB exporter. `OPENAI_API_KEY` is unused by the current intake workflow. No Attio credential is required for recording a CRM reference.

Customization prompt:

> Adjust the intake configuration for [expected volume/source]. Inspect IntakeConfig and the admission/dispatcher behavior first. Keep schema constraints, two-dispatch concurrency bound, one-process storage, production authentication, stable event identity and pending-run recovery. Add tests of the changed observable admission behavior and update the defaults table. Do not add independent environment overrides for every setting.
