# Input and output providers

Choose one input and one output in `.env`. Both default to `local`, independently of the server mode.

```dotenv
LEAD_INPUT_PROVIDER=local
LEAD_OUTPUT_PROVIDER=attio
```

| Input   | Output  | Behavior                                                         |
| ------- | ------- | ---------------------------------------------------------------- |
| `local` | `local` | JSON intake, Studio/API review, and local text/Markdown reports  |
| `attio` | `attio` | Signed Attio intake and native Stage review                      |
| `local` | `attio` | JSON intake and Attio updates; review through Studio/API         |
| `attio` | `local` | Signed Attio intake and local reports; review through Studio/API |

Attio requires its [list mapping and credentials](attio.md). Only Attio input needs the signing secret and installs webhook routes. With Attio output, JSON `destinationReference` must identify an existing entry in the mapped list. Changing providers doesn't migrate existing runs or destinations; finish pending work before switching.

## Add a driver

Implement `EventInputProvider` from `src/mastra/providers/input.ts` or `OutputProvider` from `src/mastra/providers/output.ts`. Register the factory in `src/mastra/config/input-providers.ts` or `output-providers.ts`, then select its ID in `.env`. Only the selected factories run. No workflow changes are needed.

Input factories receive the store, admission service, review service, selected output, and intake configuration. The driver defines its trusted `source` binding and normalizes its own payload. JSON drivers use the shared event endpoint; custom transports provide their routes and call `intake.receive`. Authenticate deliveries and durably acknowledge them before background hydration. `drain` lets the dispatcher process a durable inbox.

Output factories receive the database client. `read` returns current fields and the last operation marker. `apply` compares expected owned fields, writes only the authorized patch with its stable operation ID, and preserves unrelated data. Optional projection and presentation hooks adapt storage and readable results. Return authoritative read-back so interrupted writes can be reconciled before retrying. Document any read/write race when the service lacks atomic compare-and-set.

For application-specific factories, override the selections in `src/mastra/index.ts`:

```ts
const application = await createApplicationRuntime({
  inputProvider: context => createSalesFormInput(context),
  outputProvider: client => createCompanyDirectoryOutput(client),
});
```

The example factory functions are your driver implementations. Their IDs and source/destination binding must agree. An input CRM reference is context supplied by that driver; it doesn't select a provider or trigger an extra CRM lookup.

Outputs use operator review by default. A connected command driver can require external review and call `decideFromProvider` or `reopenFromProvider` after verifying the actor, current packet, command time, and destination state. Webhook payloads and workflow resume data never authorize a write themselves.
