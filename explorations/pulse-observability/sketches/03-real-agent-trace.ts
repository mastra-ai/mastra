/**
 * Real Agent Trace — Exploration Sketch
 *
 * Walk through a concrete 2-turn agent conversation with a tool call
 * and produce the exact pulse stream. Then compare data volume to
 * the equivalent span tree.
 */

// ---------------------------------------------------------------------------
// The scenario
// ---------------------------------------------------------------------------
//
// Agent: "support" (model: claude-sonnet, tools: [search, lookup])
// User: "What's the refund policy?"
// Agent: calls search("refund policy"), then responds
//
// Turn 1: user message → model call → tool_call finish → tool execution
// Turn 2: tool result → model call → text response

// ---------------------------------------------------------------------------
// The pulse stream (what gets stored)
// ---------------------------------------------------------------------------

const pulseStream = [
  // p1: Agent run begins
  {
    id: 'p1',
    parentId: undefined, // root pulse = trace root
    ts: 1000,
    kind: 'agent.start',
    data: {
      agent: { id: 'support', name: 'Support Agent', model: 'claude-sonnet-4-20250514' },
      tools: ['search', 'lookup'],
      maxSteps: 10,
      threadId: 'thread-abc',
      runId: 'run-123',
      // NOTE: full agent config — serialized from the actual Agent object
      // If Agent gains a new field tomorrow, it automatically appears here
    },
  },

  // p2: First model call begins
  {
    id: 'p2',
    parentId: 'p1', // child of agent.start
    ts: 1001,
    kind: 'model.start',
    data: {
      // Only NEW data. Agent config is already on p1, not repeated.
      messages: [{ role: 'user', content: "What's the refund policy?" }],
      // NOTE: this is the full message list for the first call.
      // For subsequent calls, we'll only include NEW messages (delta).
    },
  },

  // p3: First model call ends (tool_calls finish reason)
  {
    id: 'p3',
    parentId: 'p1', // child of agent.start (sibling of p2)
    ts: 1500,
    kind: 'model.end',
    targets: 'p2', // closes the scope opened by p2
    duration: 499,
    data: {
      finishReason: 'tool-calls',
      usage: { inputTokens: 150, outputTokens: 45 },
      toolCalls: [{ name: 'search', args: { query: 'refund policy' } }],
      // NOTE: tool calls are in the model response, so they go here.
      // The actual tool execution is a separate pulse below.
    },
  },

  // p4: Tool execution begins
  {
    id: 'p4',
    parentId: 'p1', // child of agent.start
    ts: 1501,
    kind: 'tool.call',
    data: {
      tool: 'search',
      input: { query: 'refund policy' },
    },
  },

  // p5: Tool execution completes
  {
    id: 'p5',
    parentId: 'p1', // child of agent.start (sibling of p4)
    ts: 1800,
    kind: 'tool.result',
    targets: 'p4', // closes the scope opened by p4
    duration: 299,
    data: {
      output: {
        results: [
          { title: 'Refund Policy', content: 'Full refund within 30 days of purchase...' },
        ],
      },
    },
  },

  // p6: Second model call begins (with tool result)
  {
    id: 'p6',
    parentId: 'p1', // child of agent.start
    ts: 1801,
    kind: 'model.start',
    data: {
      // DELTA: only the NEW messages since last model call
      // Previous messages (user message from p2) are NOT repeated
      newMessages: [
        { role: 'assistant', content: null, toolCalls: [{ name: 'search', args: { query: 'refund policy' } }] },
        { role: 'tool', name: 'search', content: 'Full refund within 30 days of purchase...' },
      ],
    },
  },

  // p7: Second model call ends (text response)
  {
    id: 'p7',
    parentId: 'p1', // child of agent.start
    ts: 2200,
    kind: 'model.end',
    targets: 'p6', // closes the scope opened by p6
    duration: 399,
    data: {
      finishReason: 'stop',
      usage: { inputTokens: 280, outputTokens: 35 },
      output: 'Our refund policy allows a full refund within 30 days of purchase.',
    },
  },

  // p8: Agent run ends
  {
    id: 'p8',
    parentId: undefined, // same level as p1? or child of p1?
    ts: 2201,
    kind: 'agent.end',
    targets: 'p1', // closes the scope opened by p1
    duration: 1201,
    data: {
      output: 'Our refund policy allows a full refund within 30 days of purchase.',
      // Total usage could be computed from children, or emitted here for convenience
      totalUsage: { inputTokens: 430, outputTokens: 80 },
    },
  },
];

// ---------------------------------------------------------------------------
// The tree structure (visual)
// ---------------------------------------------------------------------------

/*
  p1  agent.start   { agent config, tools, input }
  ├── p2  model.start  { messages: [user msg] }
  ├── p3  model.end    { usage, toolCalls }          [targets: p2]
  ├── p4  tool.call    { tool: search, input }
  ├── p5  tool.result  { output: results }            [targets: p4]
  ├── p6  model.start  { newMessages: [assistant, tool result] }
  ├── p7  model.end    { usage, output }              [targets: p6]
  p8  agent.end        { output, totalUsage }          [targets: p1]
*/

// Total: 8 pulses for a 2-turn agent conversation with a tool call.

// ---------------------------------------------------------------------------
// Comparison: equivalent span tree (what the current system produces)
// ---------------------------------------------------------------------------

/*
  SPAN: agent_run (root)
    name: "agent run: 'support'"
    entityType: AGENT, entityId: "support", entityName: "Support Agent"
    attributes: {
      conversationId: "thread-abc",
      instructions: "...",           ← full instructions string
      availableTools: ["search", "lookup"],
      maxSteps: 10,
    }
    metadata: { runId: "run-123", resourceId: "...", threadId: "thread-abc" }
    input: [{ role: "user", content: "What's the refund policy?" }]
    output: "Our refund policy allows a full refund within 30 days of purchase."

    ├── SPAN: model_generation
    │     entityType: AGENT, entityId: "support"  ← DUPLICATED from parent
    │     attributes: {
    │       model: "claude-sonnet-4-20250514",
    │       provider: "anthropic",
    │       streaming: true,
    │       usage: { inputTokens: 150, outputTokens: 45 },
    │       finishReason: "tool-calls",
    │     }
    │     input: [{ role: "user", content: "What's the refund policy?" }]  ← DUPLICATED
    │
    │     └── SPAN: model_step (step 0)
    │           entityType: AGENT, entityId: "support"  ← DUPLICATED again
    │           attributes: { stepIndex: 0, usage: {...}, finishReason: "tool-calls" }
    │           input: [{ role: "user", content: "..." }]  ← DUPLICATED again
    │           output: { toolCalls: [...] }
    │
    │           └── SPAN: model_chunk (×N)  ← one span per chunk!
    │                 entityType: AGENT  ← DUPLICATED
    │                 attributes: { chunkType: "tool-call", sequenceNumber: N }

    ├── SPAN: tool_call
    │     entityType: AGENT, entityId: "support"  ← DUPLICATED
    │     attributes: { toolType: "search", success: true }
    │     input: { query: "refund policy" }
    │     output: { results: [...] }

    ├── SPAN: model_generation (second call)
    │     entityType: AGENT, entityId: "support"  ← DUPLICATED
    │     attributes: { model: "...", usage: { inputTokens: 280, outputTokens: 35 } }
    │     input: [
    │       { role: "user", content: "What's the refund policy?" },    ← DUPLICATED (3rd time!)
    │       { role: "assistant", toolCalls: [...] },
    │       { role: "tool", content: "..." },
    │     ]
    │     output: "Our refund policy..."
    │
    │     └── SPAN: model_step (step 1)
    │           input: [ALL MESSAGES AGAIN]  ← DUPLICATED (4th time for user message!)
    │           ...
    │
    │           └── SPAN: model_chunk (×N)
*/

// ---------------------------------------------------------------------------
// Data volume comparison
// ---------------------------------------------------------------------------

/*
  Pulse stream:
  - 8 pulses
  - User message appears ONCE (in p2)
  - Agent config appears ONCE (in p1)
  - Tool result appears ONCE (in p5)
  - Entity info (entityType/entityId) appears ZERO times as separate fields
  - No chunk-level pulses (default mode)

  Current span tree:
  - ~8+ spans (more with chunks)
  - User message appears 4+ times (root input, model_generation input,
    model_step input for step 0, model_step input for step 1)
  - entityType/entityId copied to every span (~8 copies)
  - model_chunk spans add N more spans
  - Each span carries ~20 nullable fields (most empty)

  Rough estimate for this example:
  - Pulse stream: ~2KB of JSON
  - Span tree: ~8-12KB of JSON (4-6x more)

  For a 10-turn conversation, the ratio gets worse:
  - Pulse stream: ~10KB (linear growth — each turn adds delta messages)
  - Span tree: ~100KB+ (quadratic growth — each turn duplicates all previous messages)
*/

// ---------------------------------------------------------------------------
// How an LLM would read this pulse stream
// ---------------------------------------------------------------------------

/*
  An agent debugging "why did this fail?" would receive:

  [p1] agent.start: Support Agent (claude-sonnet), tools: [search, lookup]
  [p2] model.start: user says "What's the refund policy?"
  [p3] model.end: decided to call search("refund policy"), 150 in / 45 out tokens
  [p4] tool.call: search({ query: "refund policy" })
  [p5] tool.result: found "Full refund within 30 days of purchase..."
  [p6] model.start: sending tool result back to model
  [p7] model.end: responded "Our refund policy allows a full refund within 30 days", 280 in / 35 out
  [p8] agent.end: done, total 430 in / 80 out tokens

  This reads like a story. The LLM can understand exactly what happened
  without reconstructing a tree or correlating across separate log/span/metric stores.

  Compare to the current system where the LLM would need to:
  1. Fetch the trace spans
  2. Understand the SpanType hierarchy
  3. Parse SpanTypeMap attributes for each type
  4. Deduplicate the repeated messages
  5. Correlate logs (from a separate store)
  6. Correlate metrics (from a separate store)
*/

export { pulseStream };
