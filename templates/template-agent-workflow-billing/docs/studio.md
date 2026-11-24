# Billing in Studio

`BILLING_STUDIO_ENABLED=true` is the default in `.env.example`. Run `npm run dev` and open [Studio](http://127.0.0.1:4111). `npm run build` includes Studio with this flag; `npm start` serves the built UI. Rebuild after changing it. Follow the [README](../README.md) for local profiles or [Autumn](autumn.md#test-autumn-sandbox-in-studio) for sandbox JWTs.

With `BILLING_STUDIO_ENABLED=false`, the bundled conversation agent and billing Playground tools are not registered. Billing HTTP endpoints and the server-side facade still work and native paid routes remain blocked. Ordinary native resources retain their own routes. The flag does not remove the Studio UI from the development server or turn off billing.

## Authentication

In **Settings → Mastra Connection → Headers**, add `Authorization: Bearer <credential>` and save. Local mode uses `profiles.owner.credential` from `data/local-profiles.json`; Autumn uses a verified JWT. Expired JWTs must be replaced in Settings. Keys and Autumn secrets stay on the server.

Local setup creates John, Emma and Alex with separate personal organizations and 30 simulated credits each. Existing profiles, credentials and spending are preserved. Use each person's own credential. The optional `X-Billing-Workspace` header selects an authorized shared workspace; otherwise the user's personal workspace is resolved. Request Context cannot change identity or payer.

## Chat and approval

Open **Agents → Image Assistant**. It calls **Image Generation** (`image-agent`, one credit) or **Image Kit** (`image-kit`, three credits). These technical IDs, including the conversation ID `studio-assistant`, are retained for saved history and operations. Conversation consumes no template credits but still uses the operator's text-model account.

Choose a conversation model with the model selector below the message input. The provider must have credentials configured on the server. **Reset to the agent's model** restores the configured default. Selection applies to the conversation, including its native message and signal requests; business agents and workflows keep their server-owned models, credit policies and reservations. Conversation model usage is billed by its provider, independently of template credits.

The selector reads the authenticated `GET /api/agents/providers` catalog and the native model-policy reads at `GET /api/editor/builder/settings` and `GET /api/editor/builder/models/available`. These read-only endpoints preserve the server's model policy; editor mutations remain blocked. Requests accept only a `provider/model` identifier in native conversation stream options. Browser-supplied model configuration objects, URLs, keys, headers, tools and identity overrides are rejected.

1. Ask for one image. The business tool calls the billing facade; the gateway authenticates, checks access and reserves one credit before invoking the business agent.
2. Successful durable output confirms the reservation. The tool returns an `operationId`, artifact metadata and a receipt. A rejected reservation returns `insufficient_credits` without business compute.
3. For a kit, the gateway reserves three credits and the workflow saves three prompts before suspension. Review them and select **Approve**. Only complete success confirms three credits; nested agents have no separate charge.
4. **Decline** explicitly cancels the saved workflow. Treat the hold as released only after the receipt says so. Pending/uncertain settlement is not a confirmed refund.

**Stop** and disconnect end conversation activity, not admitted business work. Reopen history and ask to query saved operations; omit `operationId` to recover the latest twenty initiating operations for this conversation/resource. Querying does not generate again. Explicitly ask to cancel business work when intended. A new generation tool call creates new work.

History and operations belong to the exact user/workspace/agent/thread. Membership and ownership are checked on every request/action. Another member of the payer workspace cannot read the creator's private results. Attachments, message editing, forks, raw traces/storage and direct native paid execution stay closed. Ordinary agents cannot address protected threads. These protections survive disabling the wrapper.

## Tools Playground

Billing tools remain available alongside chat. Each requires `workspaceId`, validated against current membership.

| Tool                        | Additional input                                                | Purpose                                          |
| --------------------------- | --------------------------------------------------------------- | ------------------------------------------------ |
| `billing-account`           | None                                                            | Owner's provider balance and pending settlement. |
| `billing-image-generate`    | `idempotencyKey`, `brief`                                       | One paid image.                                  |
| `billing-image-kit-start`   | `idempotencyKey`, `brief`                                       | Save prompts and hold three credits.             |
| `billing-image-kit-status`  | `executionId`                                                   | Read current state/receipt.                      |
| `billing-image-kit-approve` | `executionId`, `idempotencyKey`, `approval: {"approved": true}` | Resume saved work.                               |
| `billing-image-kit-cancel`  | `executionId`, `idempotencyKey`                                 | Cancel saved work.                               |

Repeat the same key/input to replay saved work without another charge. A changed input conflicts. Tool errors are structured failures, not successful receipts. In Autumn, `providerUsageIncludingHolds` includes held units and `consumedUnits` is null; settled receipts distinguish actual consumption. A new local account goes from 30 to 29 after one image, to 26 available while the kit is held, and remains at 26 after successful kit settlement.

## Simulate denied access

For a repeatable credit denial without spending 30 credits, use a separate local test database and profiles:

1. Copy the template into a separate demo directory; keep its `.env` in local mode and set Studio enabled.
2. Before the first `npm run setup`, set `balance: 0` instead of `balance: 30` in `scripts/setup.ts`, and use `localDemoAccounts(process.env, 0)` in `src/mastra/index.ts`. Setup initializes these new profiles with zero credits. The declarative `plans` block does not grant funds. Existing accounts are never refilled or overwritten by changed seeds.
3. Start Studio, authenticate using that copy's owner credential and ask Image Assistant to generate an image. Expect tool error `insufficient_credits`, no generated image and no business-model execution. Conversation itself may still incur text-model costs.

Alternatively, in Autumn sandbox set the test customer's credit-pool balance to zero, disable unlimited/overage, then submit a new image operation. Restore the test allowance afterward. Existing saved operation keys replay earlier results, so use a new request.

To test missing subscription, add `access: { subscription: 'pro' }` to the image resource's existing credit policy, declare its logical key and provider binding, then use a customer without that active subscription. Expect `forbidden` before business execution. Re-test with a matching active subscription and sufficient credits. For subscription-only access, use a generic business agent with ordinary output as described in the [billing guide](billing.md#subscription-only-access); the bundled private-image persistence still requires a prepaid hold. Use an isolated database/profile for local seed changes.

## Download results

Each image includes a private `downloadPath` such as `/billing/workspaces/WORKSPACE_ID/artifacts/ARTIFACT_ID`. Image Assistant can show this link. Ordinary browser links do not inherit Studio's custom Authorization header, so they may return 401. Use an authenticated frontend fetch or the included CLI:

```sh
npm run images -- download ARTIFACT_ID bird.png
# For Autumn sandbox:
npm run images -- download ARTIFACT_ID bird.png --profile-file data/autumn-sandbox/profile.json
```

The command saves an owner-only PNG, never overwrites an existing file and does not consume credits. `--url http://127.0.0.1:PORT` selects a different local port. For another local creator, use `--profile member` or `--profile outsider`. Downloads require live membership, exact creator ownership and positive settlement; another member's credential does not grant access. Missing/corrupt files return 410 and never trigger regeneration. Physical storage is described in the [README](../README.md).

## Compose your own conversation agent

Use this complete example in [src/mastra/index.ts](../src/mastra/index.ts). It uses one Mastra instance, a prepared billing integration, explicit plans/meters/policies, a free conversation agent and registered business resources. It uses existing local setup profiles. Replace the example agents/workflow with your application's definitions without importing Studio into them.

The wrapper's entry point is [src/studio-billing/index.ts](../src/studio-billing/index.ts). Its neighboring modules provide the contracts, HTTP middleware, conversation-agent decoration and business-operation tools. The image example's resource adapters and Playground actions live in [src/images/image-adapters.ts](../src/images/image-adapters.ts); this generic example defines its own resources below.

```ts
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { Memory } from '@mastra/memory';
import { z } from 'zod';
import { createBilling } from '../billing/integration.js';
import { localDemoAccounts } from '../billing/providers/local/accounts.js';
import { registerApplicationShutdown } from '../billing/lifecycle.js';
import { createStudioBillingWrapper } from '../studio-billing/index.js';

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

Keep the lockfile and the compatible `@mastra/memory` version. Revalidate native chat, history, Stop/reconnect, tool approval and route isolation before framework upgrades.
