# Open Issues Analysis - @epinzur

**Generated:** 2025-12-01
**Last Updated:** 2025-12-01
**Total Issues:** 23 (2 cloud issues removed, 2 in PR review)

---

## Action Plan

### Phase 1: Respond to Issues (Current)
Work through issues in batches of 3, drafting responses to update users on status and gather any additional context needed.

### Phase 2: Feature Development
Two foundational features that will unblock multiple issues:

1. **Tagging Support** - Add tagging throughout observability, passing to Braintrust/Langfuse and other exporters that support it
   - Unblocks: #9849, #10174

2. **Exporter-Specific Metadata** - Mechanism for passing metadata to specific exporters using syntax like `metadata.<exporter_name>.key = value`
   - Example: `metadata.langfuse.promptId = prompt1234`
   - Unblocks: #8075, #10172, #8301

### Phase 3: Remaining Bug Fixes
Address issues that don't require the above features:
- Braintrust token counting bugs (#9853, #9821)
- SensitiveDataFilter bug (#9846)
- Other exporter-specific issues

---

## Summary by Category

| Category | Count | Key Focus |
|----------|-------|-----------|
| Braintrust Exporter | 8 | Token counting, trace formatting, data mapping |
| Langfuse Integration | 6 | Prompt linking, trace merging, userId/sessionId |
| Core Tracing/Telemetry | 5 | Span attributes, data filtering, processors |
| Observability Docs & UI | 3 | Token tracking visibility, documentation |
| Other/Misc | 2 | PostHog integration, cleanup strategies |

---

## Group 1: Braintrust Exporter Issues (8 issues)

All related to the `@mastra/braintrust` integration. Many share common root causes around token attribute mapping and trace formatting.

### #9820 - Trace names inconsistent and non-deterministic ✅ RESPONDED 2025-12-01
- **Priority:** High
- **Type:** Bug
- **URL:** https://github.com/mastra-ai/mastra/issues/9820
- **Summary:** Trace names show "Step 0" instead of expected "agent run: ..." and change unpredictably. Three traces in quick succession showed inconsistent naming.
- **Root Cause:** Spans created with incorrect parent relationships. Fixed in PR #9946 (main), backport to 0.x in progress.

### #9853 - Token counts dropped from API calls ✅ CONFIRMED
- **Priority:** -
- **Type:** Bug
- **URL:** https://github.com/mastra-ai/mastra/issues/9853
- **Summary:** Several fields missing from Braintrust table view: LLM duration, LLM calls, prompt/completion/total tokens, estimated cost. Values appear in trace details but not in summation calculations.
- **Related:** #9821 (cached tokens)
- **Root Cause:** `MODEL_CHUNK` spans are mapped to `llm` type, causing Braintrust to double-count LLM calls (counts both generation and chunk spans).
- **Fix:** Change `MODEL_CHUNK` mapping from `'llm'` to `'task'` in `observability/braintrust/src/tracing.ts` line 53.

### #9852 - Previous tool calls dropped in trace output
- **Priority:** -
- **Type:** Bug
- **URL:** https://github.com/mastra-ai/mastra/issues/9852
- **Summary:** Braintrust exporter drops subagent/tool calls in traces. Empty spans appear "from" assistant that should show tool calls.

### #9821 - Cached tokens not accounted for
- **Priority:** -
- **Type:** Bug
- **URL:** https://github.com/mastra-ai/mastra/issues/9821
- **Summary:** With Anthropic prompt caching enabled, Braintrust shows 0 cached prompt tokens despite cache hits. Total token count doesn't include cached tokens.

### #9848 - No data under "Thread" view
- **Priority:** -
- **Type:** Bug
- **URL:** https://github.com/mastra-ai/mastra/issues/9848
- **Summary:** Braintrust's Thread view (pretty prints messages with role + content) shows no data for Mastra agent runs, but works with direct AI SDK usage.

### #9822 - Input/output columns show raw JSON
- **Priority:** -
- **Type:** Bug
- **URL:** https://github.com/mastra-ai/mastra/issues/9822
- **Summary:** Input and output columns in Braintrust show raw JSON payload instead of plain text user/assistant messages.

### #9849 - Allow tags for BraintrustExporter
- **Priority:** -
- **Type:** Enhancement
- **URL:** https://github.com/mastra-ai/mastra/issues/9849
- **Summary:** Request to support Braintrust's native tag system for filtering. Options proposed:
  1. Tags at exporter init level (one-size-fits-all)
  2. Tags at generation level via `tracingOptions` (more flexible, per-generation)

### Potential Batch Fix Strategy
- **Token issues (#9853, #9821):** Likely same root cause - need to properly map `gen_ai.usage.cache_read_input_tokens` and ensure all token fields are exported
- **Trace formatting (#9822, #9848):** May need to format input/output to match Braintrust's expected schema for Thread view
- **Tool calls (#9852):** Check how tool call spans are being exported and ensure proper parent-child relationships

---

## Group 2: Langfuse Integration Issues (6 issues)

All related to `@mastra/langfuse` tracing and observability.

### #7175 - How to merge multiple traces into a single trace
- **Priority:** High
- **Type:** Enhancement
- **URL:** https://github.com/mastra-ai/mastra/issues/7175
- **Summary:** When using client-side tools with `useChat`, each tool call creates a new server request, resulting in:
  1. Multiple traces in Langfuse with duplicate content
  2. Tool call spans separated across traces
  3. LLM-as-a-Judge triggered multiple times
- **User tried:** Passing unique traceId but not working
- **Solution needed:** Way to continue/merge traces across requests

### #8075 - AI tracing - prompt tracing not working
- **Priority:** High
- **Type:** Bug
- **URL:** https://github.com/mastra-ai/mastra/issues/8075
- **Summary:** Tracing not properly correlating with Langfuse prompts, can't follow linked generations. User created repro: https://github.com/tommyOtsai/test-ai-tracing
- **Reference:** Langfuse docs for Vercel AI SDK prompt linking work, but not with Mastra

### #10174 - Tags and cached token count support
- **Priority:** Medium
- **Type:** Enhancement
- **URL:** https://github.com/mastra-ai/mastra/issues/10174
- **Summary:** Two issues:
  1. Need to add Langfuse tags within workflow steps (not just at runtimeContext level)
  2. Cached tokens not sent with trace (using OpenRouter/OpenAI SDK), causing inaccurate cost calculations

### #10172 - Tracing prompts with Langfuse
- **Priority:** Medium
- **Type:** Enhancement
- **URL:** https://github.com/mastra-ai/mastra/issues/10172
- **Summary:** Using Langfuse for prompt management, but can't link tracing to prompts created in Langfuse with versions. User tried `updateActiveObservation` but still only sees raw prompt.

### #8960 - Trace ID mismatch between tracingContext and Langfuse
- **Priority:** -
- **Type:** Bug
- **URL:** https://github.com/mastra-ai/mastra/issues/8960
- **Summary:** Trace ID on `tracingContext.currentSpan` doesn't match trace ID reported to Langfuse.
- **Status:** Waiting for author

### #8301 - Set tracingOptions from playground on workflows
- **Priority:** Low/Medium (effort: low, impact: medium)
- **Type:** Enhancement
- **URL:** https://github.com/mastra-ai/mastra/issues/8301
- **Summary:** Can't assign userId and sessionId on workflow for Langfuse observability. `tracingContext.currentSpan.update()` updates metadata but Langfuse doesn't recognize them as actual userId/sessionId.
- **Proposed:** Make `tracingOptions` available at workflow level, propagating to all steps.

### Potential Batch Fix Strategy
- **Trace merging (#7175):** Core infrastructure change - need way to pass existing traceId and continue trace
- **Prompt linking (#8075, #10172):** Need to implement Langfuse prompt tracking protocol
- **Tags/metadata (#10174, #8301):** Ensure Langfuse-specific metadata (tags, userId, sessionId) are properly mapped

---

## Group 3: Core Tracing/Telemetry Improvements (5 issues)

General tracing infrastructure improvements applicable across all exporters.

### #10012 - Telemetry output excessive with agent networks
- **Priority:** High
- **Type:** Enhancement
- **URL:** https://github.com/mastra-ai/mastra/issues/10012
- **Summary:** When agents can call other agents (network functionality), telemetry captures a span for each chunk, creating massive log output. Example shows continuous span_ended events for each text-delta.

### #10230 - Add agent_id to `chat {model}` span ✅ IN REVIEW
- **Priority:** -
- **Type:** Enhancement
- **URL:** https://github.com/mastra-ai/mastra/issues/10230
- **PR:** https://github.com/mastra-ai/mastra/pull/10591 (pending external review)
- **Summary:** Agent Runs span has `agent_id` but not `gen_ai.usage`. LLM Operations `chat {model}` has `gen_ai.usage` but not `agent_id`. Makes it difficult to aggregate `gen_ai.usage` by agent.
- **Solution:** Add `agent_id` attribute to the `chat {model}` span

### #9846 - SensitiveDataFilter fails to redact tool results in MODEL_STEP
- **Priority:** - (but security-related)
- **Type:** Bug
- **URL:** https://github.com/mastra-ai/mastra/issues/9846
- **Summary:** SensitiveDataFilter redacts TOOL_CALL span outputs but fails to redact same data in MODEL_STEP span inputs (function_call_output messages). Creates false sense of security.
- **Steps:**
  1. Configure filter with fields like `["fullName", "email"]`
  2. Tool returns objects with these fields
  3. TOOL_CALL output: redacted ✓
  4. MODEL_STEP input messages: NOT redacted ✗

### #8829 - Refactor deprecated gen_ai semantic conventions ✅ IN REVIEW
- **Priority:** Low
- **Type:** Enhancement
- **URL:** https://github.com/mastra-ai/mastra/issues/8829
- **PR:** https://github.com/mastra-ai/mastra/pull/10591 (pending external review)
- **Summary:** OtelExporter uses deprecated semantic conventions:
  - `gen_ai.prompt` → should be `gen_ai.input.messages`
  - `gen_ai.completion` → should be `gen_ai.output.messages`
- **Note:** Community member offered to contribute

### #8543 - Async Span Processor Support
- **Priority:** Low
- **Type:** Enhancement
- **URL:** https://github.com/mastra-ai/mastra/issues/8543
- **Summary:** Customer requested async methods in span processors for API enrichment. Currently `AISpanProcessor.process()` is synchronous.
- **Options analyzed:**
  1. Add `processAsync()` method (challenges with ordering)
  2. Separate processor lists (sync vs async)
  3. Internal async queue (processor manages own async)
  4. Make entire chain async (breaking change)
- **Recommendation:** Short-term: document pattern. Long-term: consider Option 2

---

## Group 4: Observability Documentation & Token Tracking (3 issues)

### #8955 - Token consumption observability docs
- **Priority:** -
- **Type:** Documentation
- **URL:** https://github.com/mastra-ai/mastra/issues/8955
- **Summary:** Request for documentation on measuring token consumption per thread per model, especially with workflows/tools calling other agents.

### #8828 - Show useful info when token exceeds model limit
- **Priority:** -
- **Type:** Enhancement
- **URL:** https://github.com/mastra-ai/mastra/issues/8828
- **Summary:** When finishReason is `length` (token limit exceeded), the observation page doesn't show useful information. Need better UI indication.

### #8149 - [Timeline] AI Tracing - umbrella tracking issue
- **Priority:** High
- **Type:** Tracking
- **URL:** https://github.com/mastra-ai/mastra/issues/8149
- **Summary:** Master tracking issue for AI Tracing work. Lists:
  - **In progress:** Custom trace metadata from API, Otel-Bridge, Clickhouse storage
  - **Up next:** Docs for metadata on root-trace, Suspend/Resume workflow tracing
  - **Before deprecating old telemetry:** hideInput/hideOutput, MCP tool tracing, client-side tools, etc.
  - **Backlog:** Various exporters (PostHog, Datadog), LangfuseSpanProcessor, scorer tracing

---

## Group 5: Mastra Cloud Issues (3 issues)

These may require Mastra Cloud infrastructure access to investigate/fix.

### #10382 - How to filter traces per run ID
- **Priority:** High
- **Type:** Enhancement
- **URL:** https://github.com/mastra-ai/mastra/issues/10382
- **Summary:** Docs say you can filter by trace ID but user can't find the UI option to do so.

---

## Group 6: Other/Misc (2 issues)

### #7939 - New LLM instance for every API call (PostHog integration)
- **Priority:** -
- **Type:** Enhancement
- **URL:** https://github.com/mastra-ai/mastra/issues/7939
- **Summary:** User wants to use PostHog LLM analytics which requires wrapping AI SDK with `withTracing()` per-request (needs userId from request). But Mastra requires LLM instance at compile time.
- **Need:** Way to create/wrap LLM instance at request time with user-specific data

### #7479 - Periodic cleanup strategy for old traces/snapshots
- **Priority:** -
- **Type:** Enhancement
- **URL:** https://github.com/mastra-ai/mastra/issues/7479
- **Summary:** `mastra_traces` and `mastra_workflow_snapshots` tables growing very large. Request for cleanup strategy/recommendation.

---

## Recommended Prioritization

### In Review (PR #10591 - Otel GenAI Semantic Conventions)
1. **#10230** - Add agent_id to chat span
2. **#8829** - Refactor deprecated gen_ai semantic conventions

### Quick Wins
- None identified currently - tags (#9849) requires API design work

### Medium Effort, High Impact
1. **#9846** - SensitiveDataFilter bug (security-related)
2. **#7175** - Langfuse trace merging for client-side tools (common pain point)
3. **#9853 + #9821** - Braintrust token counting (likely same root cause)

### Needs Investigation
1. **#9820** - Braintrust trace names (need to understand root cause)
2. **#10012** - Excessive telemetry with agent networks (performance profiling)

### Cloud Team (may need internal access)
1. **#10316** - Security: REST calls work after disabled (URGENT)
2. **#10620** - Studio stuck on starting
3. **#10382** - Trace filtering UI

### Documentation/Low Priority
1. **#8955** - Token consumption docs
2. **#8543** - Async span processor (complex, needs design)

---

## Next Steps

1. [ ] Merge PR #10591 after review (closes #10230, #8829)
2. [ ] Investigate Braintrust token counting issues (#9853, #9821)
3. [ ] Fix SensitiveDataFilter redaction bug (#9846)
4. [ ] Design solution for trace merging (#7175)
5. [ ] Triage Mastra Cloud issue (#10382) with internal team
