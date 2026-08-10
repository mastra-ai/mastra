# Seed Scenarios

These scenarios should drive the next pass.

## 1. Normal Agent Run

Sequence:

1. run starts
2. model call starts
3. model emits text/tool call
4. tool runs
5. model incorporates tool result
6. run ends

Test:

- origin Pulse
- parent/child edges
- temporal order edges
- content introduction
- tool definition use

## 2. Thread With Multiple Flows

Sequence:

1. user turn creates flow A
2. later user turn creates flow B in same thread
3. flow B references flow A as previous flow

Test:

- `thread_contains_flow`
- `previous_flow`
- whether `next_flow` is derivable

## 3. Suspended And Resumed Execution

Sequence:

1. workflow/agent suspends waiting for input
2. later resume creates new runtime segment
3. resumed segment relates to suspended Pulse

Test:

- `resume_of` versus `parent_of`
- whether resumed segment stays in the same flow or starts a related flow
- whether a derived Flow index can show both segments coherently

## 4. External Parent Bridge

Sequence:

1. Mastra run starts inside an ambient external trace/span
2. Mastra emits its own origin Pulse
3. external correlation is preserved without becoming execution parentage

Test:

- `external_parent`
- compatibility with PR #20499 lesson
- avoiding overloaded `parent` semantics

## 5. Scoped Definition Change

Sequence:

1. agent starts with config v4
2. processor narrows active tools for step 1
3. tool call uses the narrowed tool
4. next step restores or changes active tools

Test:

- `uses_config_version`
- `enables_definition`
- `disables_definition`
- whether direct `uses_tool_definition` edges are required on each tool call

## 6. Context Compaction Without Snapshot

Sequence:

1. user input enters context
2. memory pull enters context
3. model output enters context
4. compaction replaces several content items with a summary item

Test:

- `introduced_content`
- `removed_content`
- `replaced_content`
- order reconstruction
- whether a SnapshotPulse is actually needed

