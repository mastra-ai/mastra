# Billing in Studio

Set `BILLING_STUDIO_ENABLED=true` in `.env`, then run `npm run dev` and open <http://127.0.0.1:4111/tools>. Local setup and the authenticated CLI remain available. `npm run build` includes Studio when this flag is set; `npm start` serves the built Studio. Rebuild after changing the flag.

## Authentication

Open **Settings → Mastra Connection → Headers**, add `Authorization` with value `Bearer <credential>`, then select **Save configuration**. For local mode use the owner credential from the private `data/local-profiles.json`. For Autumn use a JWT from your configured issuer. The token must have a valid signature, issuer, audience, subject and expiration and match a previously provisioned, active local principal. Expired tokens must be replaced in Settings.

The Studio shell and authentication capabilities are public so Settings remains reachable. Tool and agent definitions require authentication. The browser stores custom headers; use a dedicated demonstration profile and keep the token and Settings screen out of recordings. API keys, signing keys and Autumn credentials stay on the server. Studio request context cannot select a different identity.

Autumn mode requires `BILLING_MODE=production`, `BILLING_PROVIDER=autumn`, `BILLING_IDENTITY_CONFIG_FILE`, `BILLING_CONFIG_FILE`, `AUTUMN_SECRET_KEY` and trusted `AUTUMN_CONFIG_FILE`. See the [Autumn guide](autumn.md). Provision trusted JWT principals and personal/shared workspace membership before accepting requests. Customer IDs come from server bindings, never from Studio request context.

Local setup creates John (`profiles.owner`), Emma (`profiles.member`), and Alex (`profiles.outsider`) with separate personal organizations and balances. Use each person's own credential and workspace ID. To share an allowance, explicitly convert the owner's workspace and invite the other person through the organization APIs. Setup never creates shared membership automatically or renames existing profiles, including previously saved Mary profiles. It preserves credentials and spent balances.

## Run billed actions

Open a tool and choose **Playground**. The **Form** and **JSON** views use the same schemas. Every tool takes `workspaceId`, which is checked against the authenticated user's current membership.

| Tool                        | Input beyond workspaceId                                        | Result                                                          |
| --------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------- |
| `billing-account`           | None                                                            | Owner-only provider balance, consumption and pending operations |
| `billing-image-generate`    | `idempotencyKey`, `brief`                                       | Private image reference and billing receipt                     |
| `billing-image-kit-start`   | `idempotencyKey`, `brief`                                       | Saved prompts with `executionId`; reservation held              |
| `billing-image-kit-status`  | `executionId`                                                   | Private kit status and receipt                                  |
| `billing-image-kit-approve` | `executionId`, `idempotencyKey`, `approval: {"approved": true}` | Completed kit and one capture                                   |
| `billing-image-kit-cancel`  | `executionId`, `idempotencyKey`                                 | Cancellation and reservation release                            |

For local mode, read `profiles.owner.workspaceId` from `data/local-profiles.json` and paste that exact value into `workspaceId`. Replace `YOUR_OWNER_WORKSPACE_ID` below before submitting to `billing-image-generate`:

```json
{
  "workspaceId": "YOUR_OWNER_WORKSPACE_ID",
  "idempotencyKey": "image-001",
  "brief": "A small blue bird in a quiet forest"
}
```

The image agent costs one credit. The kit saves three prompts for the same subject as book and website illustrations, in order: Notion-inspired, 3D, and vector illustration. Review `result.pending.approval.prompts` before approving. The kit costs three credits only after all images persist. Copy its `executionId` into status, approval or cancellation. The creator alone can access the private result after a restart. Nested image calls have no separate charge.

Artifact references are metadata. A browser image URL does not inherit Studio's saved authorization header. The Playground result shows JSON image metadata and a billing receipt. Use the runnable authenticated download in the [image guide](images.md) to save and open the PNG; the tool result has no inline image control.

Repeat the exact input and idempotency key to replay its saved result. The receipt keeps its original `billedUnits` and sets `replayed: true`; it does not represent a new charge. Use a new key for new work. Schema errors are rejected before execution. Tool failures return a safe `error` object; they must not be interpreted as successful work.

The **Studio Assistant** also supports native text chat, persistent history, structured tool results and native approval controls. Direct native execution of billed agents/workflows, raw storage/traces, attachments, message editing and forks remain closed. Existing **Tools → Playground** actions remain available. Ordinary agents retain their native routes and the application's ordinary authentication configuration.

## Balances and receipts

Use `billing-account` before and after execution. Read the initial available balance as B, even on an existing account. A new successful image leaves B − 1. Starting the kit then shows B − 4 available while three credits are held and only one credit has been confirmed; completing it keeps B − 4 available and confirms four credits in total. Replay changes neither figure. In local mode `consumedUnits` shows the one- and four-credit totals. In Autumn mode `consumedUnits` remains null and `providerUsageIncludingHolds` includes holds; use settled receipts and matching provider evidence for confirmation, rather than treating that meter as confirmed consumption. Fresh local accounts start at 30; existing balances are never reset for a demo. `mode` identifies local simulation or Autumn; `authority` identifies provider reservations. Meters show the provider's balance and consumption at `observedAt`, with `pendingOperations` separately identifying unresolved work. `allowance` is `null`; there is no application-owned paid grant ledger.

A suspended kit holds its reservation without a confirmed charge. Successful completion confirms that same reservation; cancellation releases it. Unknown finalization stays pending or uncertain until positive matching evidence arrives. Replaying a receipt never creates another financial operation. Metered local policies use the separate outbox and may reflect consumption after background delivery.

Studio custom headers and tool testing are described in the [Mastra Studio documentation](https://mastra.ai/docs/studio/overview).

## Native text conversations

Open **Agents → Studio Assistant** after saving your authorization header. Ask “Generate one private illustration of a blue bird in a quiet forest.” The conversation itself consumes no billing credits; its text model still uses the operator's model account. A business image tool result contains `operationId`, a private artifact reference and the existing billing receipt. Only that receipt establishes financial success.

Ask for a three-style illustration kit. Its start tool saves the three prompts and holds the workflow reservation. The assistant requests native approval with the `image-kit-resume` tool. Review the saved prompts, then use **Approve** or **Decline**. Approval resumes the exact persisted business suspension. Decline explicitly cancels that workflow even though native tool execution is skipped. Nested image agents remain included in the single three-credit parent charge. To cancel later, explicitly ask to cancel the operation.

**Stop** or closing the live conversation subscription stops further conversational dispatch. It does not cancel admitted business work or release its reservation. Reopen the saved conversation and ask the assistant to query its saved operations. If the first result was lost, omit `operationId`: the agent query action and workflow query tool return up to twenty initiating operations owned by this conversation, with their current state and receipts. Use the returned `operationId` for an explicit query or cancellation. A pending or uncertain operation is reported as such; retrying its original native tool invocation cannot run paid compute again. A new tool call creates new work. Automatic assistant output after Stop is not promised. A stopped native approval card is finalized as a conversation error, so reloading offers a new message instead of stale approval controls; its business operation remains separately queryable.

The optional `X-Billing-Workspace` header chooses a shared workspace; without it, identity resolves the user's personal workspace. Live membership and permission are checked for each request and business action. Conversation history and operation results belong to the exact creator/workspace/agent/thread tuple, including within a shared payer. Editable Request Context cannot change the identity or payer. Changing the workspace header starts a separate ownership scope; it does not grant access to an existing conversation.

Mastra memory stores transcript content in the existing persistent application storage. Billing keeps only immutable ownership, native message/tool-call references and operation identities. Removing a native Stop snapshot does not remove the billing link. Existing databases upgrade additively; no reset or balance refill occurs.

## Compose your own conversation agent

This complete example uses one Mastra instance, a prepared billing integration, explicit plans/meters/policies, a free conversation agent and registered business resources. It uses existing local setup profiles. Replace the example agents/workflow with your application's definitions without importing Studio into them.

```ts
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { Memory } from '@mastra/memory';
import { z } from 'zod';
import { createBilling } from '../billing/integration.js';
import { localDemoAccounts } from '../billing/local-accounts.js';
import { registerApplicationShutdown } from '../billing/lifecycle.js';
import { createStudioBillingWrapper } from '../studio-with-billing/index.js';

const billing = createBilling({
  provider: process.env.BILLING_PROVIDER ?? 'local',
  billingKeys: { meters: [{ key: 'credits', unit: 'credits', funding: ['prepaid'] }] },
  plans: {
    allowances: [
      { key: 'starter', version: 'v1', meter: 'credits', kind: 'order', units: 30, expiry: { type: 'none' } },
    ],
    offers: [{ key: 'starter', version: 'v1', allowances: [{ key: 'starter', version: 'v1' }] }],
  },
  localAccounts: () => localDemoAccounts(process.env, 30),
});
const model = 'openai/gpt-6-luna' as const;
const analysisAgent = new Agent({
  id: 'analysis-agent',
  name: 'Analysis',
  model,
  instructions: 'Answer the supplied question concisely.',
  maxRetries: 0,
});
const input = z.strictObject({ question: z.string().min(1).max(1000) });
const review = createStep({
  id: 'review',
  inputSchema: input,
  outputSchema: input,
  suspendSchema: input,
  resumeSchema: z.strictObject({ approved: z.literal(true) }),
  execute: async ({ inputData, resumeData, suspend }) => (resumeData ? inputData : suspend(inputData)),
});
const answer = createStep({
  id: 'answer',
  inputSchema: input,
  outputSchema: z.strictObject({ text: z.string() }),
  execute: async ({ inputData }) => ({
    text: (await billing.nestedAgent('analysis-agent').generate(inputData.question)).text,
  }),
});
const report = createWorkflow({
  id: 'report-workflow',
  inputSchema: input,
  outputSchema: z.strictObject({ text: z.string() }),
  steps: [review, answer],
  options: { autoRestartActiveRuns: false },
})
  .then(review)
  .then(answer)
  .commit();
const integration = await billing.prepare({
  agents: {
    'analysis-agent': billing.agent(analysisAgent, {
      policy: { version: 'v1', charge: { type: 'credits', meter: 'credits', units: 1 } },
    }),
  },
  workflows: {
    'report-workflow': billing.workflow(report, {
      agentDependencies: ['analysis-agent'],
      policy: { version: 'v1', charge: { type: 'credits', meter: 'credits', units: 3 } },
    }),
  },
});
const studioWrapper = createStudioBillingWrapper({ integration });
studioWrapper.decorateAgent(
  new Agent({
    id: 'assistant',
    name: 'Assistant',
    model,
    instructions:
      'Use analyze for business analysis. Use report-workflow-start, query, resume and cancel for reports. Show saved pending data before requesting native approval. Never invent operation IDs or billing success.',
    memory: new Memory({ options: { lastMessages: 40, semanticRecall: false, workingMemory: { enabled: false } } }),
    defaultOptions: { maxSteps: 8 },
    tools: {
      analyze: studioWrapper.agentTool('analysis-agent'),
      ...studioWrapper.workflowTools('report-workflow', { approvalSteps: ['review'] }),
    },
  }),
);
const publicAgent = new Agent({ id: 'public-agent', name: 'Public', model, instructions: 'Answer general questions.' });
export const mastra = new Mastra({
  agents: { ...integration.agents, ...studioWrapper.agents, publicAgent },
  workflows: integration.workflows,
  tools: integration.tools,
  storage: integration.storage,
  logger: false,
  server: integration.server({ host: '127.0.0.1', port: 4111 }, { studioWrapper }),
});
await integration.attach(mastra);
registerApplicationShutdown(integration.close);
```

`agentTool(id)` provides execute/query actions. Both agent and workflow queries accept an optional `operationId`; omitting it recovers the latest twenty initiating operations for this conversation and resource without repeating execution. `workflowTools(id, { approvalSteps })` provides start/query/resume/cancel tools using registered schemas and validates resumable step IDs before serving. Mutating tools derive their request key from the persisted native invocation, never model-provided idempotency. Neither agents nor tools access SQL. Additional Mastra options, custom server routes, middleware and API prefixes stay in the normal constructor/server settings.

Use the pinned compatible `@mastra/memory` dependency and retain the template lockfile when installing. Existing Core, libSQL and CLI versions are not upgraded by the wrapper. External JSON file configuration is described in the [Autumn guide](autumn.md#configuration); scalar secrets remain environment variables.
