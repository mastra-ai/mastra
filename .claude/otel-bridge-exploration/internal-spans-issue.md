# Internal Spans Issue - Parent-Child Relationship Problem

**Date:** 2025-01-21
**Status:** ✅ RESOLVED - Option A implemented and tested

## Problem Summary

When using the OTEL bridge, child spans in Jaeger reference parent span IDs that don't exist in the trace, causing broken parent-child relationships. This happens because internal workflow spans are created in OTEL but never exported to Jaeger.

## Root Cause Analysis

### 1. Internal vs External Spans Discrepancy

Mastra has the concept of "internal" vs "external" spans:

- **External spans**: User-facing operations (agent_run, model_generation, etc.) - exported to observability backends
- **Internal spans**: Framework internals (workflow_run, workflow_step, workflow_parallel) - used for execution tracking but not exported

The OTEL bridge currently creates OTEL spans for **all** Mastra spans (both internal and external), but only **external** spans call `handleSpanEnded()` to export them to Jaeger.

### 2. Test Case Evidence

From test run output:

**Spans created by bridge** (logged in createSpan):

```
[OtelBridge.createSpan] Created span [spanId=bb20c367ed015e5e] [type=agent_run] [parentSpanId=71d216cb790ff81f]
[OtelBridge.createSpan] Created span [spanId=1330b48a1e4bb7c0] [type=workflow_run] [parentSpanId=bb20c367ed015e5e]
[OtelBridge.createSpan] Created span [spanId=d9942fa9db895a38] [type=workflow_parallel] [parentSpanId=1330b48a1e4bb7c0]
[OtelBridge.createSpan] Created span [spanId=ffa4d664c50ff891] [type=workflow_step] [parentSpanId=1330b48a1e4bb7c0]
[OtelBridge.createSpan] Created span [spanId=c6e88df8df68afb9] [type=model_generation] [parentSpanId=ffa4d664c50ff891]
... (18 total spans created)
```

**Spans exported to Jaeger** (only 4 Mastra spans visible):

```
agent_run (spanID: 586a83d6fda21613) parent: 1f350986ac05732e (demo-controller)
model_generation (spanID: 4d0b28c7c756b6ef) parent: d377ac4afda6eac6 (DOES NOT EXIST!)
model_step (spanID: 14f975cf1e40e1fd) parent: 4d0b28c7c756b6ef
model_chunk (spanID: f945b3e7e29c200b) parent: 14f975cf1e40e1fd
```

**Missing from Jaeger:**

- All workflow spans (workflow_run, workflow_parallel, workflow_step, workflow_conditional_eval, workflow_loop)
- These were created by the bridge but never ended via `handleSpanEnded()`

### 3. The Broken Chain

Expected hierarchy (from bridge creation logs):

```
demo-controller (OTEL auto-instrumentation)
└─ agent_run
   └─ workflow_run (INTERNAL)
      └─ workflow_step (INTERNAL)
         └─ model_generation
            └─ model_step
               └─ model_chunk
```

Actual hierarchy in Jaeger:

```
demo-controller
└─ agent_run ✓

??? (missing parent)
└─ model_generation ✗ (parent ID points to non-existent workflow_step)
   └─ model_step ✓
      └─ model_chunk ✓
```

### 4. Why This Happens

When `createChildSpan()` is called for `model_generation`:

1. **Mastra side**: Parent is set to `workflow_step` span
2. **Bridge createSpan()**:
   ```typescript
   if (options.parent) {
     const parentEntry = this.otelSpanMap.get(options.parent.id);
     if (parentEntry) {
       parentOtelContext = parentEntry.otelContext;
     }
   }
   ```
3. **OTEL span created** with `workflow_step` as parent context
4. **Return parent ID**:
   ```typescript
   const parentSpan = otelTrace.getSpan(parentOtelContext);
   const parentSpanId = parentSpan?.spanContext().spanId;
   return { spanId, traceId, parentSpanId };
   ```
5. **Problem**: `parentSpanId` is the ID of `workflow_step`, which is internal and will never be exported to Jaeger!

### 5. Map Pollution

The `otelSpanMap` grows to 18 entries but only 4 spans are ever exported:

```
[OtelBridge.createSpan] Created span [spanId=...] [mapSize=1]   # agent_run
[OtelBridge.createSpan] Created span [spanId=...] [mapSize=2]   # workflow_run (internal, never exported)
[OtelBridge.createSpan] Created span [spanId=...] [mapSize=3]   # workflow_parallel (internal)
...
[OtelBridge.createSpan] Created span [spanId=...] [mapSize=18]  # workflow_conditional_eval (internal)

# Only 4 calls to handleSpanEnded():
[OtelBridge] Ending OTEL span [mastraId=a6963439affc24b4] [name=chunk: 'text']
[OtelBridge] Ending OTEL span [mastraId=e969faaa537cd9ba] [name=step: 0]
[OtelBridge] Ending OTEL span [mastraId=c6e88df8df68afb9] [name=llm: 'gpt-4o-mini']
[OtelBridge] Ending OTEL span [mastraId=bb20c367ed015e5e] [name=agent run: 'Science Chat Agent']
```

This means:

- 14 spans remain in the map, never cleaned up
- Memory leak if long-running process
- Those spans' OTEL contexts are never properly ended

## Solution Options

### Option A: Don't Create OTEL Spans for Internal Spans

**Approach**: Only call `bridge.createSpan()` for external spans

**Pros:**

- Cleanest solution
- No map pollution
- No orphaned parent references
- Matches Mastra's semantic model

**Cons:**

- Need to check span external/internal flag before calling bridge
- Need to ensure internal spans still generate IDs correctly

**Implementation:**

```typescript
// In DefaultSpan constructor
const bridge = observabilityInstance.getBridge();

if (bridge && this.isExternal) {
  // Only create OTEL span if external
  const bridgeIds = bridge.createSpan(options);
  if (bridgeIds) {
    this.id = bridgeIds.spanId;
    this.traceId = bridgeIds.traceId;
    this.parentSpanId = bridgeIds.parentSpanId;
    return;
  }
}

// Fall back to generating IDs for internal spans or if bridge fails
// ... existing ID generation logic
```

### Option B: Collapse Internal Spans (Walk Up to External Parent)

**Approach**: When creating a child span, if the parent is internal, walk up the parent chain to find the nearest external parent and use that as the OTEL parent

**Pros:**

- Maintains correct parent-child relationships in Jaeger
- Internal spans still tracked in Mastra
- No changes needed to span creation logic

**Cons:**

- More complex logic in bridge
- Still creates OTEL spans for internal spans (map pollution)
- Still have memory leak issue with never-ended internal spans

**Implementation:**

```typescript
// In bridge.createSpan()
createSpan(options: CreateSpanOptions): { spanId: string; traceId: string; parentSpanId?: string } | undefined {
  let parentOtelContext = otelContext.active();

  if (options.parent) {
    // Walk up to find nearest external parent
    let currentParent = options.parent;
    while (currentParent && !currentParent.isExternal) {
      currentParent = currentParent.parent;
    }

    if (currentParent) {
      const parentEntry = this.otelSpanMap.get(currentParent.id);
      if (parentEntry) {
        parentOtelContext = parentEntry.otelContext;
      }
    }
  }

  // ... rest of createSpan logic
}
```

**Problem with Option B**: We'd need access to `isExternal` flag from `options`, but it's not currently included in `CreateSpanOptions`.

### Option C: Export All Spans (Including Internal)

**Approach**: Make internal spans also call `handleSpanEnded()` so they appear in Jaeger

**Pros:**

- Simple - everything just works
- No special cases
- Full visibility into framework internals

**Cons:**

- Creates noise in traces (lots of workflow spans)
- Users might not want/need to see internal framework operations
- Goes against Mastra's external/internal span design
- Increased volume sent to observability backend

### Option D: Hybrid - Check Parent External Status in Bridge

**Approach**: In `bridge.createSpan()`, if parent exists but is internal, use active OTEL context instead of parent context

**Pros:**

- No changes to calling code
- Bridge handles the logic
- Works with current span creation flow

**Cons:**

- Still creates OTEL spans for internal spans (not cleaned up)
- Loses parent relationship info - child would connect to whatever OTEL span is active

**Implementation:**

```typescript
// In bridge.createSpan()
if (options.parent) {
  const parentEntry = this.otelSpanMap.get(options.parent.id);
  if (parentEntry) {
    // Check if parent span will be exported (has been ended)
    // If not, skip using it as parent and use active context instead
    parentOtelContext = parentEntry.otelContext;
  }
}
```

**Problem with Option D**: We don't know at span creation time whether the parent will eventually be ended/exported.

## Recommended Solution: Option A

**Rationale:**

1. **Aligns with Mastra semantics**: Internal spans are internal to Mastra, not exposed externally
2. **Clean separation**: OTEL bridge only deals with external spans
3. **No resource leaks**: Map only contains spans that will be ended
4. **Correct parent-child relationships**: External spans can only reference other external spans as parents
5. **Matches user expectations**: Observability backends show only user-facing operations

**Required Changes:**

1. Add `isExternal` property/method to span interface or check if span type is internal
2. Update `DefaultSpan` constructor to only call `bridge.createSpan()` for external spans
3. Ensure internal spans generate their own IDs correctly without bridge

## Additional Findings

### Span ID Format

- OTEL `spanContext().spanId` returns a string in hexadecimal format (16 hex chars for 64-bit ID)
- Jaeger also displays span IDs in hex format
- IDs match between bridge logs and Jaeger for exported spans

### executeWithSpanContext Usage

```
[OtelBridge.executeWithSpanContext] spanId=c6e88df8df68afb9, inMap=true, storedOtelSpan=c6e88df8df68afb9
```

This shows that `executeWithSpanContext` is used during agent execution to maintain OTEL context for child operations (like HTTP calls to OpenAI API).

### OTEL Auto-Instrumentation Integration

The parent-child chain works correctly for OTEL-to-Mastra:

```
POST /demo/v1 (OTEL auto-instrumentation)
└─ demo-controller (OTEL span from manual tracer.startActiveSpan)
   └─ agent_run (Mastra span, correctly connected)
```

The issue only occurs for Mastra-to-Mastra relationships when internal spans are involved.

## Next Steps

1. **Decide on solution approach** - Recommend Option A
2. **Determine internal span types** - Which span types should not create OTEL spans?
   - workflow_run
   - workflow_step
   - workflow_parallel
   - workflow_loop
   - workflow_conditional_eval
   - workflow_sequence
   - (others?)
3. **Implement solution** - Update DefaultSpan constructor and add external/internal checks
4. **Test** - Verify parent-child relationships are correct in Jaeger
5. **Cleanup** - Ensure map doesn't accumulate stale entries

## Related Files

- `/Users/epinzur/src/github.com/mastra/mastra/observability/otel-bridge/src/bridge.ts` - Bridge implementation
- `/Users/epinzur/src/github.com/mastra/mastra/observability/mastra/src/spans/default.ts` - DefaultSpan constructor
- `/Users/epinzur/src/github.com/mastra/mastra/packages/core/src/observability/types/tracing.ts` - ObservabilityBridge interface
- `/Users/epinzur/src/github.com/mastra/mastra/observability/_examples/agent-hub/src/integration.test.ts` - Integration tests

## Context history:

      // This parent is internal, skip it and try its parent
        currentParent = currentParent.parent;
      }
    }

    // Create OTEL span with parentOtelContext
    // ...

}

Corrected Flow:

agent_run (EXTERNAL, isInternal=false)
└─ workflow_step (INTERNAL, isInternal=true)
└─ model_generation (EXTERNAL, isInternal=false)

With corrected approach:

1. model_generation calls bridge.createSpan({ parent: workflow_step })
2. Bridge checks: workflow_step.isInternal → true, skip it
3. Bridge walks up: workflow_step.parent = workflow_run
4. Bridge checks: workflow_run.isInternal → true, skip it
5. Bridge walks up: workflow_run.parent = agent_run
6. Bridge checks: agent_run.isInternal → false, this is external!
7. Bridge looks up: otelSpanMap.get(agent_run.id) → FOUND! ✓
8. Uses agent_run's OTEL context as parent
9. model_generation becomes child of agent_run in OTEL ✓

Why This is Better:

Semantic Check vs Map Presence

- isInternal flag = Semantic property of the span (design-time decision)
- Presence in map = Implementation detail (runtime state)

The check should be semantic: "Is this parent meant to be exported to OTEL?" not "Did
we happen to put this in our internal map?"

Robustness

If for some reason an external span wasn't added to the map (bug, timing issue,
etc.), we'd want to:

1. Log a warning (as shown above)
2. Fall back gracefully to active context

Rather than silently treating it as internal and skipping it.

Access to isInternal

The options.parent is a full span object (not just an ID), so we have access to:

- options.parent.isInternal ✓
- options.parent.parent ✓
- options.parent.id ✓
- etc.

Implementation Summary:

// Walk up parent chain, skipping internal spans
let currentParent = options.parent;

while (currentParent) {
if (!currentParent.isInternal) {
// Found external parent
const parentEntry = this.otelSpanMap.get(currentParent.id);
if (parentEntry) {
parentOtelContext = parentEntry.otelContext;
} else {
console.warn(`[OtelBridge] External parent not in OTEL map: 
  ${currentParent.id}`);
}
break;
}
currentParent = currentParent.parent;
}

This is clean, semantic, and correct! Should we proceed with implementing this
approach?

> I think you can actually just call the span.getParentSpanId() method... this takes
> care of the walking up to get the closest non-internal span, and is already proven
> correct elsewhere
> ⎿ ⧉ Selected 1 lines from ../../mastra/src/spans/base.ts in Visual Studio Code

⏺ Perfect! Let me check that method:

⏺ Read(~/src/github.com/mastra/mastra/observability/mastra/src/spans/base.ts)
⎿ Read 20 lines

⏺ Excellent! This is even better! The getParentSpanId() method at line 153 already
implements exactly what we need:

public getParentSpanId(includeInternalSpans?: boolean): string | undefined {
if (!this.parent) {
return this.parentSpanId; // No parent chain, return explicit parentSpanId if
set
}
if (includeInternalSpans) return this.parent.id; // Include internal if requested
if (this.parent.isInternal) return
this.parent.getParentSpanId(includeInternalSpans); // Skip internal, recurse

    return this.parent.id;  // Found external parent

}

This recursively walks up the parent chain, skipping internal spans, until it finds
an external parent!

Simplified Bridge Implementation:

Instead of walking the chain manually in the bridge, we can just:

createSpan(options: CreateSpanOptions): { spanId: string; traceId: string;
parentSpanId?: string } | undefined {
let parentOtelContext = otelContext.active();

    if (options.parent) {
      // Use the built-in method to find the closest external parent
      const externalParentId = options.parent.getParentSpanId(false);  // false =

exclude internal spans

      if (externalParentId) {
        const parentEntry = this.otelSpanMap.get(externalParentId);
        if (parentEntry) {
          parentOtelContext = parentEntry.otelContext;
        } else {
          console.warn(`[OtelBridge] External parent not in OTEL map:

${externalParentId}`);
}
}
}

    // Create OTEL span with parentOtelContext
    // ...

}

Wait, but there's a subtle issue. Let me re-read getParentSpanId():

- If this.parent exists:
  - If this.parent.isInternal → recursively call this.parent.getParentSpanId()
  - Else → return this.parent.id

So when we call it on the child span (model_generation):
options.parent.getParentSpanId(false)

We're calling it on workflow_step, which returns:

- workflow_step has parent workflow_run
- workflow_run.isInternal → true, so recurse
- workflow_run has parent agent_run
- agent_run.isInternal → false, so return agent_run.id ✓

Actually, wait. Let me trace this more carefully:

// options.parent = workflow_step (internal)
workflow_step.getParentSpanId(false)
→ this.parent = workflow_run (internal)
→ if (this.parent.isInternal) return this.parent.getParentSpanId()
→ workflow_run.getParentSpanId(false)
→ this.parent = agent_run (external)
→ if (this.parent.isInternal) → false
→ return this.parent.id → agent_run.id ✓

Perfect! It returns agent_run.id!

But Actually, We Need the External Parent Object, Not Just ID

Actually, looking more carefully, we need access to options.parent itself to check if
it's internal before we even get its parent ID:

if (options.parent) {
// If parent is internal, find external ancestor
if (options.parent.isInternal) {
const externalParentId = options.parent.getParentSpanId(false);
// ... look up in map
} else {
// Parent is already external, use it directly
const parentEntry = this.otelSpanMap.get(options.parent.id);
// ...
}
}

Or even simpler:

if (options.parent) {
// Always get the closest external parent ID (could be parent itself if external)
const externalParentId = options.parent.isInternal
? options.parent.getParentSpanId(false) // Skip internal parents
: options.parent.id; // Use parent directly if external

    if (externalParentId) {
      const parentEntry = this.otelSpanMap.get(externalParentId);
      if (parentEntry) {
        parentOtelContext = parentEntry.otelContext;
      }
    }

}

This is clean and leverages the existing, tested logic! Should we proceed with this
approach?

> i think you are getting confused.

i really think the getParentSpanId should be sufficent on its own.

⏺ You're right, I'm overcomplicating it. Let me think through this more simply:

When model_generation is created with options.parent = workflow_step:

// In bridge.createSpan()
if (options.parent) {
// Get the external parent ID (skipping internal spans)
const externalParentId = options.parent.getParentSpanId(false);

    if (externalParentId) {
      const parentEntry = this.otelSpanMap.get(externalParentId);
      if (parentEntry) {
        parentOtelContext = parentEntry.otelContext;
      }
    }

}

Wait, but getParentSpanId() is called on the parent (workflow_step), and it returns
its closest external parent's ID. Let me trace again:

agent_run (external, id=A)
└─ workflow_step (internal, id=W, parent=agent_run)
└─ model_generation (external, id=M, parent=workflow_step)

When creating model_generation:
options.parent = workflow_step

workflow_step.getParentSpanId(false)
→ this.parent = agent_run
→ agent_run.isInternal = false
→ return agent_run.id = "A" ✓

Perfect! It returns "A" (agent_run's ID), which IS in the OTEL map!

So the bridge code is simply:
if (options.parent) {
const externalParentId = options.parent.getParentSpanId(false);

    if (externalParentId) {
      const parentEntry = this.otelSpanMap.get(externalParentId);
      if (parentEntry) {
        parentOtelContext = parentEntry.otelContext;
      }
    }

}

Done! That's it. getParentSpanId(false) handles all the walking logic for us. You're
absolutely right - it's sufficient on its own!

> actually you might be correct... const externalParentId =
> options.parent.getParentSpanId(false); is actually the grandParentSpanId ?

⏺ Yes! You're right - I was getting confused. Let me trace through this carefully:

agent_run (external, id=A)
└─ workflow_step (internal, id=W, parent=agent_run)
└─ model_generation (external, id=M, parent=workflow_step)

When creating model_generation:
options.parent = workflow_step // The parent is workflow_step

// What does workflow_step.getParentSpanId(false) return?
workflow_step.getParentSpanId(false)
→ this.parent = agent_run // workflow_step's parent
→ agent_run.isInternal = false
→ return agent_run.id // Returns grandparent!

So options.parent.getParentSpanId(false) returns the grandparent (agent_run), not the
parent itself!

What we actually need:

We want to find the closest external ancestor of the child span being created.

If the immediate parent is external, use it. If it's internal, skip up to find the
first external one.

So we need a different approach - maybe a method on the span that walks up from
itself to find external parent, or we need to check if options.parent is internal
first:

if (options.parent) {
let externalParentId;

    if (options.parent.isInternal) {
      // Parent is internal, find its external ancestor
      externalParentId = options.parent.getParentSpanId(false);
    } else {
      // Parent is already external, use it
      externalParentId = options.parent.id;
    }

    if (externalParentId) {
      const parentEntry = this.otelSpanMap.get(externalParentId);
      if (parentEntry) {
        parentOtelContext = parentEntry.otelContext;
      }
    }

}

Is that what you were thinking?

> that looks correct. Maybe we could make helper function that gets CreateSpanOptions

## and returns externalParentId... and we could unit test a few scenarios?

## Implementation Summary (Completed)

**Date Implemented:** 2025-01-21

### Changes Made

#### 1. Added `getExternalParentId()` Helper Function

**File:** `observability/mastra/src/spans/base.ts`

Created a reusable helper function that walks up the parent chain to find the nearest external ancestor:

```typescript
export function getExternalParentId(options: CreateSpanOptions<any>): string | undefined {
  if (!options.parent) {
    return undefined;
  }

  if (options.parent.isInternal) {
    // Parent is internal, find its external ancestor
    return options.parent.getParentSpanId(false);
  } else {
    // Parent is already external, use it directly
    return options.parent.id;
  }
}
```

**Location:** Lines 64-103 in base.ts

#### 2. Added Comprehensive Unit Tests

**File:** `observability/mastra/src/spans/base.test.ts`

Added 6 test cases covering:

- No parent → returns undefined
- External parent → returns parent.id
- Internal parent → returns grandparent.id
- Multiple internal ancestors → walks up chain correctly
- All ancestors internal → returns undefined
- Mixed internal/external hierarchy → returns correct external parent

**All tests passing ✓**

#### 3. Updated OTEL Bridge to Use Helper

**File:** `observability/otel-bridge/src/bridge.ts`

Modified `createSpan()` method to:

- Import `getExternalParentId` from `@mastra/observability`
- Use helper to find external parent ID before looking up in OTEL span map

```typescript
// Get external parent ID (walks up chain to find non-internal parent)
const externalParentId = getExternalParentId(options);
if (externalParentId) {
  // Look up external parent's OTEL span from map
  const parentEntry = this.otelSpanMap.get(externalParentId);
  if (parentEntry) {
    parentOtelContext = parentEntry.otelContext;
  }
}
```

**Location:** Lines 87-95 in bridge.ts

#### 4. Updated DefaultSpan Constructor to Skip Bridge for Internal Spans

**File:** `observability/mastra/src/spans/default.ts`

Added check to only create OTEL spans for external spans:

```typescript
// Only create OTEL span via bridge for external spans
// Internal spans are not exported, so they shouldn't be created in OTEL
const bridge = observabilityInstance.getBridge();
if (bridge && !this.isInternal) {
  const bridgeIds = bridge.createSpan(options);
  // ...
}
```

**Location:** Lines 19-30 in default.ts

### Verification Results

**Integration test output shows:**

1. **Only 4 OTEL spans created** (down from 18):
   - `agent_run` (external)
   - `model_generation` (external)
   - `model_step` (external)
   - `model_chunk` (external)

2. **No internal workflow spans in OTEL** - Bridge map size only goes 1→2→3→4 (not 18)

3. **Correct parent-child relationships**:

   ```
   agent_run (parent: demo-controller)
   └─ model_generation (parent: agent_run) ✓
      └─ model_step (parent: model_generation) ✓
         └─ model_chunk (parent: model_step) ✓
   ```

4. **No orphaned parent references** - All parent span IDs exist in Jaeger

5. **All integration tests passing**:
   - ✓ should handle demo request without OTEL trace context
   - ✓ should extract OTEL trace context from traceparent header
   - ✓ All 5 tests passed

### Benefits of This Solution

1. **Semantic correctness** - Internal spans are truly internal to Mastra, not exposed to OTEL
2. **No map pollution** - OTEL span map only contains spans that will be exported
3. **No memory leaks** - All spans in map are properly ended and cleaned up
4. **Correct parent-child relationships** - External spans only reference other external spans
5. **Reusable helper** - `getExternalParentId()` can be used by other exporters/bridges
6. **Well tested** - Comprehensive unit tests ensure correctness

### Files Modified

1. `observability/mastra/src/spans/base.ts` - Added `getExternalParentId()` helper
2. `observability/mastra/src/spans/base.test.ts` - Added 6 unit tests
3. `observability/otel-bridge/src/bridge.ts` - Updated to use helper function
4. `observability/mastra/src/spans/default.ts` - Skip bridge for internal spans

### Issue Resolution

✅ **Problem:** Internal workflow spans created in OTEL but never exported, causing broken parent-child relationships
✅ **Solution:** Don't create OTEL spans for internal Mastra spans
✅ **Result:** Clean traces with only external spans, correct parent-child relationships, no orphaned references
