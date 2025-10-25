# Workflow Library Integration Analysis

## Executive Summary

This document analyzes the Vercel Workflow library (useworkflow.dev) and compares it with Mastra's workflow system to determine the feasibility of building an execution engine adapter, similar to the Inngest integration.

**Key Finding**: While both systems share the concept of durable workflows with steps, they operate at fundamentally different levels of abstraction. Workflow is a **compiler-based runtime** that transforms JavaScript code, while Mastra is a **framework-based orchestrator** with explicit step definitions. An execution engine adapter is **not feasible** in the traditional sense, but there are alternative integration strategies.

---

## System Comparison

### Vercel Workflow DevKit

**Architecture:**
- **Compiler-based transformation**: Uses SWC plugin (`@workflow/swc-plugin-workflow`) to transform JavaScript/TypeScript code at build time
- **Directive-driven**: Functions marked with `"use workflow"` and `"use step"` directives
- **VM-based execution**: Workflow functions run in a sandboxed Node.js VM context with limited runtime access
- **Event log persistence**: Progress is saved as an event log, enabling deterministic replay
- **World abstraction**: Storage, queuing, and streaming abstracted through the `World` interface

**Key Components:**
```
packages/core         - Core workflow runtime and primitives
packages/world        - Interface for storage backends
packages/world-local  - Local filesystem backend
packages/world-vercel - Vercel platform backend
packages/next         - Next.js integration
packages/cli          - Standalone CLI mode
```

**Execution Model:**
1. **Workflow functions** (`"use workflow"`): Orchestrators running in sandboxed VM
2. **Step functions** (`"use step"`): Individual operations with full Node.js access
3. **Compiler splits** code into separate bundles (client, workflow, step contexts)
4. **Event log** tracks execution progress for replay after failures

**Example:**
```typescript
export async function welcome(userId: string) {
  "use workflow";
  
  const user = await getUser(userId);
  const { subject, body } = await generateEmail({
    name: user.name, plan: user.plan
  });
  
  const { status } = await sendEmail({
    to: user.email,
    subject,
    body,
  });
  
  return { status, subject, body };
}
```

### Mastra Workflow System

**Architecture:**
- **Framework-based orchestration**: Explicit workflow and step definitions using builders
- **Execution engine abstraction**: Pluggable execution engines (default, Inngest, etc.)
- **Type-safe builders**: Fluent API with TypeScript type inference
- **Persistent snapshots**: Workflow state persisted to storage for resume/suspend
- **Multiple execution strategies**: Sequential, parallel, conditional, loops, foreach

**Key Components:**
```
Workflow class        - Main workflow orchestrator
Step class           - Individual workflow steps
ExecutionEngine      - Abstract execution interface
DefaultExecutionEngine - In-process execution
InngestExecutionEngine - Inngest integration
```

**Execution Model:**
1. **Workflows** orchestrate step execution through a graph
2. **Steps** define input/output schemas and execute functions
3. **Execution engine** determines how steps are executed (local, Inngest, etc.)
4. **Storage** persists workflow snapshots for durability

**Example:**
```typescript
const incrementWorkflow = createWorkflow({
  id: 'increment-workflow',
  inputSchema: z.object({ value: z.number() }),
  outputSchema: z.object({ value: z.number() }),
})
  .then(incrementStep)
  .then(sideEffectStep)
  .then(finalStep)
  .commit();
```

---

## Key Differences

| Aspect | Workflow DevKit | Mastra Workflows |
|--------|----------------|------------------|
| **Abstraction Level** | Code transformation (compiler) | Framework orchestration |
| **Definition Style** | Implicit (directives) | Explicit (builders) |
| **Execution Context** | Sandboxed VM | Full Node.js runtime |
| **Step Isolation** | Automatic (compiler-enforced) | Manual (developer-defined) |
| **Durability** | Event log replay | Snapshot persistence |
| **Type Safety** | TypeScript + runtime checks | Zod schemas + TypeScript |
| **Integration** | Build-time transformation | Runtime composition |
| **Portability** | Platform-specific (Vercel-optimized) | Platform-agnostic |

---

## Technical Analysis

### Architectural Incompatibilities

1. **Execution Model Mismatch**
   - Workflow: VM-based replay from event log
   - Mastra: Graph-based execution with snapshots
   - **Impact**: Cannot directly map one execution model to the other

2. **Code Transformation vs. Runtime Orchestration**
   - Workflow: Requires build-time SWC plugin transformation
   - Mastra: Pure runtime orchestration
   - **Impact**: Would need to transform Mastra steps into Workflow steps at build time

3. **State Management**
   - Workflow: Deterministic replay from event log
   - Mastra: Explicit state persistence with resumeability
   - **Impact**: Different durability guarantees and resume semantics

4. **Step Definition**
   - Workflow: Functions with directives, implicitly become steps
   - Mastra: Explicit step objects with schemas
   - **Impact**: Different programming models

### Integration Challenges

1. **No Traditional "Execution Engine" Pattern**
   - Workflow doesn't expose an "execute this graph" API
   - It's a **runtime**, not an **executor**
   - Cannot implement `ExecutionEngine` interface to delegate to Workflow

2. **Build-Time Requirements**
   - Workflow requires SWC plugin at build time
   - Mastra workflows are defined at runtime
   - No way to retroactively transform Mastra code

3. **Different Abstraction Layers**
   - Workflow: Low-level runtime primitives
   - Mastra: High-level orchestration patterns
   - Inngest: External service with HTTP API
   - Workflow and Mastra operate at different layers

---

## Overlap and Synergies

Despite architectural differences, there are conceptual overlaps:

### Shared Concepts

1. **Durable Execution**
   - Both provide durability across failures
   - Both can suspend and resume execution
   - Both persist execution state

2. **Step-Based Composition**
   - Both decompose workflows into steps
   - Both track step execution status
   - Both support retries

3. **Async Patterns**
   - Both support Promise.all, Promise.race
   - Both handle parallel execution
   - Both work with standard JavaScript async

4. **Type Safety**
   - Both use TypeScript
   - Both validate inputs/outputs
   - Both provide type inference

### Potential Synergies

1. **Complementary Use Cases**
   - Workflow: Excellent for **function-level durability** (AI agents, long API calls)
   - Mastra: Excellent for **multi-service orchestration** (integrations, complex pipelines)
   - Could use both in the same application for different purposes

2. **Shared Tooling**
   - Both could benefit from observability tools
   - Both need similar debugging experiences
   - Both have similar monitoring needs

3. **Learning from Design**
   - Workflow's VM sandboxing provides strong isolation
   - Mastra's execution engine abstraction provides flexibility
   - Both patterns have value in different contexts

---

## Alternative Integration Strategies

Since a traditional execution engine adapter is not feasible, here are alternative approaches:

### 1. **Workflow-to-Mastra Bridge** (Code Generation)

Generate Mastra workflows from Workflow definitions using static analysis:

```typescript
// Input: Workflow function
async function myWorkflow(userId: string) {
  "use workflow";
  const user = await getUser(userId);
  return await sendEmail(user);
}

// Generated: Mastra workflow
const myWorkflow = createWorkflow({
  id: 'myWorkflow',
  inputSchema: z.object({ userId: z.string() }),
  outputSchema: z.any(),
})
  .then(createStep({
    id: 'getUser',
    inputSchema: z.object({ userId: z.string() }),
    outputSchema: z.any(),
    execute: async ({ inputData }) => getUser(inputData.userId)
  }))
  .then(createStep({
    id: 'sendEmail',
    inputSchema: z.any(),
    outputSchema: z.any(),
    execute: async ({ inputData }) => sendEmail(inputData)
  }))
  .commit();
```

**Pros:**
- Enables using Workflow's programming model with Mastra's execution
- One-way transformation at build time
- Could use existing tooling

**Cons:**
- Lossy transformation (VM isolation, determinism lost)
- Complex to implement reliably
- Maintenance burden
- May not preserve Workflow semantics

### 2. **Mastra-to-Workflow Wrapper** (Runtime Adapter)

Wrap Mastra steps as Workflow step functions:

```typescript
// Mastra step
const getUserStep = createStep({
  id: 'getUser',
  inputSchema: z.object({ userId: z.string() }),
  outputSchema: z.object({ name: z.string() }),
  execute: async ({ inputData }) => {
    return { name: 'John' };
  }
});

// Workflow wrapper
async function getUser(userId: string) {
  "use step";
  // Execute Mastra step
  const mastraRun = await getUserStep.execute({
    inputData: { userId },
    // ... other context
  });
  return mastraRun;
}
```

**Pros:**
- Reuse Mastra steps in Workflow context
- Maintains Workflow's durability guarantees
- Simpler than full transformation

**Cons:**
- Loses Mastra orchestration features
- Requires manual wrapping
- Doesn't leverage Mastra's execution engines

### 3. **Side-by-Side Architecture** (Recommended)

Use both systems for their strengths without forcing integration:

```typescript
// Use Workflow for durable functions
async function processDocument(docId: string) {
  "use workflow";
  const doc = await fetchDocument(docId);
  const analysis = await analyzeWithAI(doc); // Long-running AI call
  return analysis;
}

// Use Mastra for service orchestration
const notificationWorkflow = createWorkflow({
  id: 'notifications',
  // ...
})
  .parallel([emailStep, slackStep, smsStep])
  .commit();

// Combine at application level
app.post('/process', async (req, res) => {
  // Use Workflow for durability
  const analysis = await processDocument(req.body.docId);
  
  // Use Mastra for orchestration
  await notificationWorkflow.createRunAsync()
    .then(run => run.start({ inputData: analysis }));
  
  res.json({ success: true });
});
```

**Pros:**
- Leverages both systems' strengths
- No complex integration needed
- Clear separation of concerns
- Both remain maintainable

**Cons:**
- Need to understand two systems
- Increased dependencies
- Potential overlap in some areas

### 4. **Shared Observability Layer**

Build shared monitoring/debugging tools that work with both:

```typescript
// Unified workflow observability
class WorkflowMonitor {
  trackMastraWorkflow(run) { /* ... */ }
  trackWorkflowRun(run) { /* ... */ }
  
  // Common interface for both systems
  getExecutionTrace(id) { /* ... */ }
  getStepMetrics(id) { /* ... */ }
}
```

**Pros:**
- Provides value without forcing integration
- Useful for teams using both
- Focus on developer experience

**Cons:**
- Doesn't solve orchestration differences
- Limited scope

---

## Updated Recommendation (Based on Step-Mode Analysis)

**The initial assessment was incorrect!** After examining the SWC transformation output, **integration IS feasible** using step-mode compilation.

### Recommended Approach: Step-Mode Adapter

Build an adapter that uses Workflow's step-mode compiled output with Mastra's orchestration. See the detailed implementation guide in `WORKFLOW_STEP_MODE_INTEGRATION.md` and the proof-of-concept in `workflow-adapter/`.

**Key insight**: In step mode, the SWC plugin preserves function bodies as plain async functions. We can import and wrap these as Mastra steps without any Workflow runtime dependencies.

### Alternative Approach: Side-by-Side (If Step-Mode Not Desired)

1. **Document clear use cases** for each system:
   - **Workflow DevKit**: Function-level durability, AI agents, long-running API calls
   - **Mastra Workflows**: Multi-service orchestration, complex business logic, integration pipelines

2. **Provide interop examples** showing how to use both together:
   - Calling Workflow functions from Mastra steps
   - Triggering Mastra workflows from Workflow steps
   - Shared state management patterns

3. **Consider future opportunities**:
   - If Workflow exposes a more flexible execution API in the future
   - If Mastra adds VM-based step isolation
   - If either system evolves to be more compatible

4. **Document architectural differences** clearly so users understand trade-offs

---

## Example: Using Both Systems Together

```typescript
// File: workflows/document-processing.ts (Workflow)
export async function processDocument(docId: string) {
  "use workflow";
  
  // Durable function - survives failures
  const document = await fetchDocument(docId);
  
  // Long-running AI processing
  const embedding = await generateEmbedding(document.content);
  const analysis = await analyzeContent(document.content);
  
  return { docId, embedding, analysis };
}

// File: mastra/workflows/notification-pipeline.ts (Mastra)
const notificationWorkflow = createWorkflow({
  id: 'send-notifications',
  inputSchema: z.object({
    docId: z.string(),
    analysis: z.object({ /* ... */ })
  }),
  outputSchema: z.object({ sent: z.boolean() }),
})
  .parallel([
    emailNotificationStep,
    slackNotificationStep,
    webhookNotificationStep,
  ])
  .then(logNotificationStep)
  .commit();

// File: app/api/documents/process/route.ts (Application)
export async function POST(req: Request) {
  const { docId } = await req.json();
  
  // Step 1: Process with Workflow (durable)
  const result = await processDocument(docId);
  
  // Step 2: Orchestrate notifications with Mastra
  const mastra = getMastraInstance();
  const workflow = mastra.getWorkflow('send-notifications');
  const run = await workflow.createRunAsync();
  
  await run.start({
    inputData: {
      docId: result.docId,
      analysis: result.analysis,
    }
  });
  
  return Response.json({ success: true });
}
```

---

## Conclusion

The Workflow library and Mastra workflows solve related but distinct problems:

- **Workflow**: Compiler-based runtime for durable JavaScript functions
- **Mastra**: Framework-based orchestrator for multi-step workflows

They operate at different abstraction levels and have incompatible execution models. Rather than forcing integration through an execution engine adapter, the recommended approach is:

1. Use both systems side-by-side for their respective strengths
2. Provide clear documentation on when to use each
3. Create interop examples showing how they can complement each other
4. Monitor the evolution of both systems for future integration opportunities

This approach maximizes value for users while respecting the architectural differences between the systems.
