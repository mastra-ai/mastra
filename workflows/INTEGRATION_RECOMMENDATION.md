# Workflow Integration Recommendation - Final

## TL;DR

**YES, integration is feasible!** Build a step-mode adapter that uses Workflow's compiled output with Mastra's orchestration.

## What Changed

Initial analysis concluded that integration wasn't feasible due to architectural differences. However, after examining the SWC transformation output, we discovered that **step-mode compilation produces plain async functions** that can be directly used in Mastra workflows.

## How It Works

### The Key Insight

Workflow's SWC plugin has three modes:
- **Step mode**: Preserves function bodies, just adds registration
- **Workflow mode**: Replaces bodies with runtime calls  
- **Client mode**: Proxies to server

**Step mode gives us exactly what we need**: plain async functions with business logic intact.

### Transformation Example

**Input (Workflow code):**
```typescript
export async function add(a, b) {
  'use step';
  return a + b;
}
```

**Output (Step mode):**
```typescript
export async function add(a, b) {
  return a + b;  // ← Original logic preserved!
}
registerStepFunction("step//input.js//add", add);
```

The function is just a normal async function we can import and use!

## Proposed Architecture

```
┌─────────────────────────────────────────────────────┐
│ 1. Write Workflow Steps                             │
│    workflows/my-steps.ts                             │
│    ├─ export async function fetchUser(id) {         │
│    │    'use step';                                  │
│    │    return await db.users.get(id);              │
│    │  }                                              │
│    └─ export async function sendEmail(...) { ... }  │
└─────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────┐
│ 2. Compile with SWC (step mode)                     │
│    $ swc workflows --plugin @workflow/swc-plugin    │
│                       --mode=step                    │
│                       --out-dir .compiled            │
└─────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────┐
│ 3. Import & Wrap in Mastra                          │
│    import { fetchUser } from './.compiled/my-steps' │
│                                                      │
│    const step = wrapWorkflowStep({                  │
│      id: 'fetch-user',                              │
│      workflowStepFn: fetchUser,                     │
│      inputSchema: z.object({ id: z.string() }),     │
│      outputSchema: z.object({ name: z.string() }),  │
│      argsMapper: (input) => [input.id],             │
│    });                                               │
└─────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────┐
│ 4. Use in Mastra Workflows                          │
│    const workflow = createWorkflow({ ... })         │
│      .then(step)                                     │
│      .parallel([...])                                │
│      .commit();                                      │
└─────────────────────────────────────────────────────┘
```

## Benefits

### ✅ For Developers

1. **Write once**: Define step logic using Workflow's clean `"use step"` syntax
2. **Orchestrate powerfully**: Use Mastra's parallel, conditional, loops, etc.
3. **Multiple engines**: Run with DefaultEngine, Inngest, or custom engines
4. **Type safety**: Zod schemas + TypeScript throughout
5. **Incremental adoption**: Mix Workflow steps with native Mastra steps

### ✅ For Mastra

1. **Expand ecosystem**: Compatible with Workflow's growing community
2. **Clean step definitions**: Developers love Workflow's syntax
3. **No runtime coupling**: Just use the compiled output
4. **Differentiation**: Mastra adds orchestration to Workflow's steps

## Implementation Status

### Completed ✅

- [x] Analysis of Workflow architecture
- [x] Discovery of step-mode compilation approach
- [x] Design of adapter interface
- [x] Proof-of-concept implementation
- [x] Basic example
- [x] Real-world example (user onboarding)
- [x] Documentation

### In Progress 🚧

Located in `workflows/workflow-adapter/`:
- `src/index.ts` - Adapter implementation
- `README.md` - Usage documentation
- `examples/` - Working examples

### Next Steps 📋

1. **Testing**
   - Add test suite for adapter
   - Test with real Workflow projects
   - Validate type safety edge cases

2. **Build Integration**
   - Create CLI helper: `mastra workflow wrap`
   - Auto-generate Zod schemas from TypeScript types
   - Watch mode for development

3. **Documentation**
   - Add to Mastra docs site
   - Create video walkthrough
   - Blog post announcement

4. **Polish**
   - Better error messages
   - Schema inference improvements
   - TypeScript type helpers

## Trade-offs to Consider

### What You Gain 🎉

- Clean step definitions (Workflow syntax)
- Powerful orchestration (Mastra features)
- Multiple execution engines
- Rich ecosystem integration

### What You Lose ⚠️

- Workflow's VM sandboxing (steps run in full Node.js context)
- Workflow's deterministic replay (Mastra uses snapshots instead)
- Workflow's automatic event logging (Mastra has its own telemetry)
- Some compile-time guarantees (different execution model)

**Note**: These are Workflow *runtime* features, not part of the step functions themselves. The business logic is preserved completely.

## When to Use Each Approach

### Use Workflow + Mastra (This Adapter)

- ✅ Need powerful orchestration (parallel, conditional, loops)
- ✅ Want to use Inngest or other execution engines
- ✅ Building complex multi-service workflows
- ✅ Need Mastra's integrations and tools
- ✅ Want clean step syntax + powerful features

### Use Workflow Natively

- ✅ Need VM sandboxing for security
- ✅ Need deterministic replay from event logs
- ✅ Building on Vercel with Workflow's optimizations
- ✅ Simple workflows without complex orchestration
- ✅ Want minimal setup and configuration

### Use Mastra Natively

- ✅ Don't need Workflow syntax
- ✅ Want maximum control over execution
- ✅ Building custom execution engines
- ✅ Need specific Mastra features only

## Example Usage

```typescript
// 1. Write Workflow steps (workflows/api-calls.ts)
export async function fetchUser(userId: string) {
  'use step';
  const res = await fetch(`/api/users/${userId}`);
  return res.json();
}

export async function sendEmail(to: string, body: string) {
  'use step';
  await emailService.send({ to, body });
  return { sent: true };
}

// 2. Compile: pnpm compile:workflow-steps

// 3. Wrap and use in Mastra (mastra/workflows/onboarding.ts)
import { fetchUser, sendEmail } from '../../.compiled/api-calls';
import { wrapWorkflowStep } from '@mastra/workflow-adapter';

const fetchUserStep = wrapWorkflowStep({
  id: 'fetch-user',
  workflowStepFn: fetchUser,
  inputSchema: z.object({ userId: z.string() }),
  outputSchema: z.object({ name: z.string(), email: z.string() }),
  argsMapper: (input) => [input.userId],
});

const emailStep = wrapWorkflowStep({
  id: 'send-email',
  workflowStepFn: sendEmail,
  inputSchema: z.object({ to: z.string(), body: z.string() }),
  outputSchema: z.object({ sent: z.boolean() }),
  argsMapper: (input) => [input.to, input.body],
});

// 4. Build Mastra workflow with orchestration
const workflow = createWorkflow({
  id: 'user-onboarding',
  inputSchema: z.object({ userId: z.string() }),
  outputSchema: z.object({ emailSent: z.boolean() }),
})
  .then(fetchUserStep)
  .then(emailStep)
  .commit();

// 5. Execute with any Mastra engine
const run = await workflow.createRunAsync();
const result = await run.start({ inputData: { userId: '123' } });
```

## Recommendation

**Proceed with building the step-mode adapter.** 

This approach:
1. ✅ Is technically feasible (proof-of-concept works)
2. ✅ Provides real value (best of both worlds)
3. ✅ Has clean architecture (no hacky workarounds)
4. ✅ Maintains both systems' integrity
5. ✅ Opens up new possibilities for developers

## Files to Review

- `WORKFLOW_STEP_MODE_INTEGRATION.md` - Detailed technical analysis
- `workflow-adapter/src/index.ts` - Adapter implementation
- `workflow-adapter/README.md` - Usage guide
- `workflow-adapter/examples/` - Working examples

## Questions?

Reach out to the team with any questions or feedback on this approach!
