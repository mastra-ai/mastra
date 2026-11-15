# Billing architecture

Use the [billing guide](billing.md) for configuration and API examples, [Studio](studio.md) for interaction, and [Autumn](autumn.md) for provider setup. This reference describes implementation boundaries and the module layout.

## Integration API

| Surface                                           | Responsibility                                                                                                                                                                                                           |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `integration.agents` / `.workflows`               | Native resource maps returned by `prepare`. Wrapped business resources keep their native type; their HTTP execution routes are protected. Unwrapped entries remain ordinary native resources.                            |
| `studioWrapper.agents`                            | Separate decorated conversation agents, such as Image Assistant. Their business tools call the billing facade. Spreading this map adds chat entry points; it does not duplicate the paid business agent.                 |
| `integration.tools`                               | Authenticated Studio actions, including the balance reader and optional catalog actions. Tools are not automatically paid; their called resource's policy decides the charge. Undefined when Studio billing is disabled. |
| `integration.storage`                             | Durable Mastra workflow snapshots and conversation memory, normally in `workflow.db`. Financial bookkeeping lives separately in `billing.db`. The same workflow store must be used by Mastra and recovery.               |
| `integration.server(settings, { studioWrapper })` | Adds Hono billing routes and an early transport boundary, preserving application settings/routes/middleware. Closes native paid routes and composes the optional conversation proxy.                                     |
| `integration.attach(mastra)`                      | Validates resource identity, aliases, wrapper memory and shared snapshot storage; installs the early server middleware through Mastra's public API and starts recovery. One attachment per integration.                  |

`attach` is a composition/lifecycle step with middleware installation. It is not a TypeScript decorator or a global interception of `agent.generate`. Trusted application code must call the billing facade to enforce charging.

`createBillingApplication({ catalog, createMastra })` is the alternate factory API. Here “catalog” means a typed `ResourceCatalog`: resource definitions/factories, adapters, policies, commercial configuration and optional artifact reader. It is not the Autumn pricing catalog. The factory materializes these definitions, creates one Mastra instance and returns a service bundle including `.mastra`. It is used by the provider/image verification scripts and tests; the main template uses explicit `createBilling` → `prepare` → `new Mastra` → `attach` composition.

## Where enforcement happens

```mermaid
sequenceDiagram
    actor User
    participant Studio
    participant Wrapper
    participant Gateway
    participant Provider
    participant Agent
    User->>Studio: Request an image
    Studio->>Wrapper: Native chat request + bearer token
    Wrapper->>Wrapper: Verify identity, membership and conversation owner
    Wrapper->>Gateway: Business tool dispatch with persisted request key
    Gateway->>Provider: Read access and reserve one credit
    alt Insufficient credits or missing subscription
        Provider-->>Gateway: Denied / absent access
        Gateway-->>Wrapper: Structured billing error
        Wrapper-->>Studio: Tool failure; business agent not invoked
    else Admission succeeds
        Gateway->>Agent: Execute inside admitted scope
        Agent-->>Gateway: Durable result
        Gateway->>Provider: Confirm the reserved credit
        Gateway-->>Studio: Result and settlement receipt
    end
```

The text conversation can call a model before business admission. Its provider cost is distinct from template credits. `runtime/gateway.ts`, `runtime/accounting.ts` and `storage/accounting.ts` enforce access and reservation/settlement; providers implement the commercial authority. `studio-with-billing/studio-chat-proxy.ts` guards native routes and conversation ownership, while `studio-operation-tools.ts` sends root operations through the same gateway as `/billing`. Nested agents share the parent budget.

## Mastra compatibility

The wrapper decorates public methods on explicitly registered conversation-agent instances (including generate/stream, message dispatch, approval and abort), preserving trusted conversation context and delegating to the original methods. It does not decorate the business agents for charging; their tools enter the billing gateway.

The wrapper uses public native chat, memory, thread subscription, abort and tool-approval APIs. It also relies on their route shapes, persisted message/tool-call identities and approval/Stop lifecycle. Framework changes can cause missing chat history, rejected routes, stuck approval cards or lost operation correlation. Unreviewed newly introduced routes could also weaken isolation if an allowlist were broadened indiscriminately. Unsupported routes currently fail closed.

Dependency declarations use `latest` for framework packages; the lockfile fixes installed versions and memory has an explicit compatible version. Keep the lockfile and re-run `npm run check`, unit/integration/provider tests and Studio journeys when updating it. Verify Stop/reconnect, decline/cancel, replay, creator/workspace isolation and native-route rejection before deployment. No Core/Studio frontend changes, private SDK methods, prototype patches or global method interception are used.

## Platform support

The current implementation supports macOS/Linux with Node.js 22.13+ or 24. Windows is rejected before private state initialization because these storage helpers require POSIX ownership, mode 0600/0700, no-follow opens, safe link handling and durable file/directory synchronization. Creating a file on Windows is possible; reproducing these privacy/durability guarantees is the missing implementation.

Windows support is feasible with a filesystem adapter using NTFS owner/DACL checks, restricted inheritance and reparse-point/hard-link protections, applied at creation and verified before SQLite, credentials or images are accessed. Windows provides [icacls](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/icacls), but simply running it after creating a secret file leaves an exposure window and does not implement all these guarantees. Node's [filesystem documentation](https://nodejs.org/api/fs.html#fschmodpath-mode-callback) explains the limited Windows chmod semantics. A maintained native ACL dependency or Win32 helper could implement the adapter; real Windows tests are still required. No Windows support is claimed by this revision.

For an existing Windows host, run the template in WSL2 or a Linux container and keep private state on that environment's Linux filesystem/volume. Removing the platform guard or ignoring chmod/ownership failures would weaken the existing private-storage contract.

## Image provider boundary

`images/service.ts` runs inside an admitted Mastra tool execution, then calls OpenAI's Images endpoint directly. The business Agent is a text model orchestrating that tool; an image-generation model is a different interface. Direct fetch controls bounded response reading, timeout/abort, no automatic generation retry, PNG validation and durable artifact claims. Billing is based on the operation, not on an LLM telemetry token count.

The [AI SDK supports image generation](https://ai-sdk.dev/docs/ai-sdk-core/image-generation) through `generateImage` and an image-model provider, which could replace the HTTP adapter while retaining these safeguards. This template does not use that API or claim that an image model can be substituted into its text Agent configuration. Mastra can orchestrate the image call through tools, as it does here.

## Module map

All paths below are relative to `src/billing/`. `contracts/` contains shared interfaces and schemas; `configuration/` owns parsing and provider selection; `runtime/` executes policies; provider-specific implementations and persistence live under `providers/local/` and `providers/autumn/`; shared persistence and transport retain their own folders.

| File                                    | Purpose                                                                                                   |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `application.ts`                        | Alternate catalog-driven application factory; creates Mastra and the service bundle.                      |
| `configuration/catalog.ts`              | Versioned allowance/offer schemas and commercial references.                                              |
| `configuration/environment.ts`          | Resolves operating mode, database paths, organization identity and config files.                          |
| `configuration/files.ts`                | Reads explicitly configured external JSON files and rejects invalid/missing input.                        |
| `configuration/policy.ts`               | Resource policy, billing configuration, seed schemas and capability validation.                           |
| `configuration/providers.ts`            | Selects/initializes local or Autumn drivers or an injected provider.                                      |
| `contracts/artifacts.ts`                | Private artifact reading and execution-owned artifact persistence interfaces.                             |
| `contracts/core.ts`                     | Shared errors, identifiers, quantities, commercial snapshots and usage/hosted-session types.              |
| `contracts/execution.ts`                | Typed agent/workflow result and registry contracts.                                                       |
| `contracts/provider.ts`                 | BillingProvider interface implemented by all drivers.                                                     |
| `contracts/reservations.ts`             | Reservation/finalization schemas, budgets and provider reservation protocol.                              |
| `contracts/server.ts`                   | Shared HTTP/server composition options for execution, identity, commercial services and artifact readers. |
| `identity.ts`                           | Local credential and verified asymmetric JWT authentication adapters.                                     |
| `integration.ts`                        | Public createBilling API, resource registration, prepared integration, server composition and attachment. |
| `lifecycle.ts`                          | Owns cleanup callbacks and closes initialized services on shutdown/failure.                               |
| `mastra-resources.ts`                   | Native agent/workflow adapters with bounded execution and completion validation.                          |
| `mastra-setup.ts`                       | Initializes provider, accounting, durable Mastra storage and recovery services.                           |
| `mastra.ts`                             | Typed billing facade and shared HTTP execution API for agents/workflows.                                  |
| `organizations.ts`                      | Principal provisioning, personal/shared organizations, membership and permissions.                        |
| `providers/autumn/index.ts`             | Autumn bindings, real SDK calls, access/balances, locks, settlement evidence and hosted sessions.         |
| `providers/autumn/storage.ts`           | Immutable Autumn customer/workspace associations and historical payer verification.                       |
| `providers/local/accounts.ts`           | Converts prepared development profiles into trusted local account seeds.                                  |
| `providers/local/credit-transitions.ts` | Retained migration of historical local meters without refilling spent balances.                           |
| `providers/local/index.ts`              | Simulated provider: state, prepaid reservations and replay-safe local usage.                              |
| `providers/local/profiles.ts`           | Reads/writes the private local demonstration identity manifest.                                           |
| `providers/local/storage.ts`            | Local provider SQL balances, commercial grants, reservation settlement and usage deduplication.           |
| `resource-catalog.ts`                   | Typed resource definitions, custom actions, catalog validation and materialization.                       |
| `runtime/accounting.ts`                 | Shared execution/request/outcome schemas, fingerprints, eligibility and billing helpers.                  |
| `runtime/agent-execution.ts`            | Billed agent generation, replay, nested dispatch and status projection.                                   |
| `runtime/commercial.ts`                 | Owner-authorized usage, checkout, portal and provider-notification service.                               |
| `runtime/execution-scope.ts`            | Process-local admitted execution context used by tools and artifact slots.                                |
| `runtime/gateway.ts`                    | Authenticates admission, checks commercial access, reserves before compute and finalizes outcomes.        |
| `runtime/invocation-context.ts`         | Tracks parent/nested invocation context and explicit root dispatch.                                       |
| `runtime/measurement.ts`                | Collects trusted bounded usage measurements and nested-call evidence.                                     |
| `runtime/recovery.ts`                   | Background reconciliation, deadline handling and recovery without repeating uncertain compute.            |
| `runtime/workflow-execution.ts`         | Billed create/start/resume/cancel/status, suspension and native workflow coordination.                    |
| `server/boundary.ts`                    | Early Hono transport boundary and protected/native route composition.                                     |
| `server/routes.ts`                      | Authenticated organization, billing execution, usage, hosted-session and private artifact routes.         |
| `server/studio.ts`                      | Authenticated Studio Playground tools and allowlisted definition/tool routes.                             |
| `storage/accounting.ts`                 | Durable execution claims, reservations, ledger, outbox and immutable remote finalization intent.          |
| `storage/accounts.ts`                   | Shared database-row to provider-account validation.                                                       |
| `storage/artifacts.ts`                  | Execution-slot claims, metadata, creator ownership and settled-read authorization.                        |
| `storage/catalog.ts`                    | Retains immutable revisions of commercial allowances/offers.                                              |
| `storage/commercial.ts`                 | Financial summaries and durable checkout/portal idempotency claims.                                       |
| `storage/conversations.ts`              | Immutable conversation ownership, native tool-call/operation correlation and approval decisions.          |
| `storage/database.ts`                   | Private SQLite/libSQL opening, transactions and schema initialization.                                    |
| `storage/migrations.ts`                 | Versioned SQL schema/migrations and compatibility checks.                                                 |
| `storage/organizations.ts`              | Persistent principals, credentials, organizations, memberships and private records.                       |
| `storage/private-files.ts`              | POSIX private directory/database permissions, ownership and link checks.                                  |
| `storage/recovery.ts`                   | SQL leases, recovery candidates and remote reconciliation transitions.                                    |
| `storage/workflows.ts`                  | Binds business executions to native workflow runs and durable lifecycle state.                            |

The import audit identified and removed the unreferenced `storage/usage-bindings.ts` helper (its read/repair exports had no callers). No orphaned billing module remains. `application.ts` is an alternate API used by scripts/tests, not the main bootstrap. Historical credit-transition code and SQL migrations remain necessary for existing databases. These are compatibility paths, not unused legacy providers. No Polar driver or dependency remains in the template.
