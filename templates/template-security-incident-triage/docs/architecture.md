# Architecture

The runtime uses Mastra agents, tools and an explicit workflow. Deterministic domain checks own authorization, evidence integrity and containment; agents only validate bounded candidates.

| Responsibility                                    | Entry points                                                         |
| ------------------------------------------------- | -------------------------------------------------------------------- |
| Studio registration                               | `src/mastra/index.ts`                                                |
| Runtime composition and provider selection        | `src/mastra/runtime.ts`, `src/providers/runtime-factory.ts`          |
| Incident workflow graph                           | `src/mastra/workflows/security-incident-workflow.ts`                 |
| Workflow operations                               | `src/mastra/steps/`                                                  |
| Agents and bounded delegation                     | `src/mastra/agents/`                                                 |
| Typed evidence and containment tools              | `src/mastra/tools/`                                                  |
| Runbook retrieval and indexing                    | `src/mastra/knowledge/`, `runbooks/`                                 |
| Triage policy and decision validation             | `src/triage/`, `src/evidence/`                                       |
| Approval, execution fence and exact target checks | `src/approval/`, `src/containment/`                                  |
| Integrations and local adapters                   | `src/providers/`                                                     |
| Signed intake and authenticated dashboard         | `src/app/webhooks/`, `src/app/auth/`, `src/app/dashboard/`           |
| HTTP application and lifecycle                    | `src/server.ts`, `src/workers/runtime.ts`, `src/start.ts`            |
| Durable operational state, migrations and outbox  | `src/db/`                                                            |
| Model traces and regression evaluation            | `src/mastra/observability.ts`, `src/mastra/evals/`, `scripts/evals/` |
| Local monitoring                                  | `src/analytics/`, `scripts/analytics-report.ts`                      |

A signed webhook is normalized and persisted with a transactional outbox event. The worker claims that event, starts the workflow and records its durable run. The workflow gathers three evidence branches in parallel, correlates them, retrieves the runbook and validates severity, summary and containment. Benign events close early; missing evidence requires manual review. An actionable plan requests approval and suspends. Authorized decisions resume that exact run and execute only the approved, tenant-bound actions. Delivery ledgers reconcile uncertain remote outcomes before retries.

Studio accepts normalized local fixtures and persists them through the same incident boundary. Its generic API is intended for local development. Hosted workers accept durable references from authenticated intake, while dashboard operations authenticate and revalidate tenant ownership.

Hono and Studio register the application through `createRuntimeMastra` in `src/mastra/runtime.ts`. The workflow module retains its default singleton and positional factory for compatibility; application configuration belongs in the runtime composition, not in those defaults. Its validated integration configuration is passed to provider selection. Mastra's orchestration PubSub and the domain outbox transport remain separate because their event contracts and ownership differ.

## Relationship to official templates

The [Mastra template guidelines](https://github.com/mastra-ai/mastra/tree/main/templates) prescribe an OpenAI default, a small environment example and a quickstart through Studio. The [KYC template](https://mastra.ai/templates/kyc-customer-onboarding) demonstrates local providers, durable approval and a separate authenticated application. [Accounts Payable](https://mastra.ai/templates/accounts-payable-automated-invoice-processing) uses provider interfaces and deterministic checks around external writes.

This template follows those conventions. It retains a custom Hono server, tenant-scoped operational tables, transactional outbox and provider-effect ledgers because incident containment needs stronger authority and recovery boundaries than a basic agent demo. Build uses TypeScript for that server instead of `mastra build`; Studio still uses `mastra dev`. Mastra dependencies use `latest` as required by the template guidelines. Template lockfiles are not committed in the monorepo, so install dependencies with `npm install`. The source lives in `templates/template-security-incident-triage/`; the monorepo template sync workflow distributes it to a standalone repository.

The template uses the monorepo Oxfmt version and conventions. The v1 evaluation dataset, response planner prompt, and offline replay source retain their original bytes because the historical dataset verifies their SHA-256 provenance. Both formatter configurations exclude these files; formatting them would invalidate the replay contract.
