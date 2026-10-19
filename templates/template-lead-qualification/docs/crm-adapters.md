# Connect a CRM or lead source

The shipped drivers are local JSON input (`generic`), readable local output (`local`) and Attio input/output (`attio`). Input and output IDs are selected independently. Without explicit configuration, local runtime selects generic/local and production selects Attio/Attio. An explicit `config` selects any registered pair while runtime mode continues to control authentication.

Read the documented contracts in `src/mastra/providers/input.ts` and `providers/output.ts`, the registry in `providers.ts`, and the admission boundary in `intake.ts`. Concrete drivers live under `providers/local/` and `providers/attio/`. Keep credentials and selection in trusted server configuration; source, destination provider and reviewer identity cannot come from event JSON.

## Input drivers and durable admission

An `EventInputProvider` declares `id`, one trusted `source` binding, `transport` and asynchronous `normalize(payload, source, receivedAt)`. It returns `{ event, expected? }` for a lead, `{ runId }` for an already handled command, or `undefined` for an irrelevant delivery. `expected` is an authoritative destination snapshot used for concurrency protection. Normalize external data with strict schemas; preserve actual inquiry provenance.

A `json` transport uses the common authenticated `POST /lead-qualification/events` endpoint, streamed body limits and response contract. A `custom` transport supplies its own `routes` and optional `drain()`. The generic JSON endpoint is absent for a custom input, including Attio. A signed webhook must authenticate raw bytes, acknowledge a durable inbox before external reads, and drain through `LeadIntake.receive`. Do not call `store.accept` directly from a driver.

The shared admission service revalidates the normalized schema, configured source/destination, CRM reference allowlist and server receipt time, then atomically persists the run, captured qualification configuration and delivery association. Driver routes and background inbox processing use this same boundary. The dispatcher drains installed inputs before dispatching accepted runs; workflow authorization derives its permitted bindings from those inputs.

## Output drivers

`OutputProvider.read(destination)` returns current owned/business values and the last operation marker, with optional concurrency revisions and readable `content`. `apply(destination, operationId, patch, expected, expectedRevision)` compares authoritative state and updates only integration-owned values with a stable operation marker. Missing destinations, competing edits and uncertain writes must remain distinguishable. Use safe `OutputError` codes and bounded retry delays in milliseconds. Document a provider's non-atomic read/write race when its API cannot compare-and-set atomically.

Optional `present` and `finalize` produce deterministic, versioned business presentation before authorization. `project` maps the exact patch to persisted destination fields; `owned` selects exact comparison fields. `matchesRevision` supports current and explicitly retained historical concurrency tokens. `reviewFields` identifies human command fields whose current values require authoritative verification. Every hook is documented in the interface; local output stores text/Markdown reports within this same projected, journaled state.

The shared review service persists policy or human authorization, then journals the exact patch, expected values and operation ID before applying it. A matching marker and exact read-back are required for success. Preserve unowned fields and reconcile a lost response before retrying. This boundary does not create deals, send messages or delete records.

## Select or register drivers

Concrete instances can be supplied using `input: new Map([[id, input]])` and `output: [output]`. Factories receive the dependencies needed by drivers after storage opens; only selected factories run. Input factories may be asynchronous to initialize an existing durable inbox.

```ts
import { Mastra } from '@mastra/core/mastra';
import { createApplicationRuntime } from './application';
import { intakeConfig } from './config/lead-ingestion';

// Implement these drivers using the documented interfaces before registering them.
const config = {
  ...intakeConfig,
  source: {
    id: 'sales-submissions',
    inputProviderId: 'sales-form',
    destinationProviderId: 'company-directory',
    crmProviderIds: ['my-crm'],
  },
};
const application = await createApplicationRuntime({
  config,
  inputFactories: new Map([['sales-form', context => createSalesInput(context.config.source, context.intake)]]),
  outputFactories: new Map([['company-directory', client => createDirectoryOutput(client)]]),
});
export const mastra = new Mastra(application.mastraConfig);
```

Factory map keys, driver IDs and input source bindings must agree. Input IDs do not need to match output IDs. Unknown selections fail startup. Local selection ignores unrelated Attio mapping files or credentials. JSON input with Attio output requires mapping/token but no webhook signing secret and installs no Attio input. Attio input with local output can create initial local qualification cycles; native Stage review/reopen/requalification commands require Attio output. Use operator review for a local destination. A custom output may impose its own source/reference requirements; registering a pair does not invent a destination or vendor mapping.

For JSON lead intake with complete native Attio review, explicitly add `additionalInputs: ['attio']` alongside the generic/Attio selection and supply the signing secret. This starts the full signed Attio input, including its durable command processing and admission of relevant new list entries. Without this additional input, Attio output can apply automatic results, but uncertain packets have no native Stage command listener. No extra transport or secret is enabled implicitly. Additional inputs must provide their own custom transport; input IDs and source IDs remain distinct.

## Trusted human review

Outputs default to `reviewMode: 'operator'`: the authenticated operator uses Studio or the review API. `reviewMode: 'external'` requires the connected driver's verified command entrypoint and blocks operator decisions for that destination. Attio uses external review. Neither a public decision payload nor native workflow resume data can supply trusted provider/actor context.

A connected driver authenticates its human actor and authoritative command time/history before calling `decideFromProvider(providerId, ...)` or `reopenFromProvider(providerId, ...)`. Bind the exact current packet, destination-owned state and revision. New stage commands can use `kind: 'provider-stage'` and reviewer `{ provider, actorId }`; existing Attio commands keep their original `attio-stage` and workspace/member reviewer data. Historical packets, authorized projections and decisions remain unchanged.

## Verify an extension

Use controlled fixtures under `tests/` to exercise actual asynchronous input normalization, qualification, authenticated review when needed, journaled output and exact read-back with distinct input/output IDs. Include duplicate delivery, restart, invalid provenance, unauthorized actors, missing destinations, concurrent edits, lost responses and unowned fields. Keep legacy projection and history coverage. Run local tests before any separately authorized live proof.

Customization prompt:

> Connect [lead source] and [destination] through the documented EventInputProvider and OutputProvider contracts and factory maps. Inspect shared admission, trusted source bindings, captured configuration, review authorization and operation journals. Preserve genuine inquiry provenance, production authentication, signed durable transport when needed, exact owned-field/revision checks, stable operation IDs, uncertain-write recovery and historical projections. Prove an actual input-to-qualification-to-journaled-output journey using distinct driver IDs, including authenticated review. Document configuration and atomicity limits; do not provision live resources or add outreach.
