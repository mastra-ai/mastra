# Family Fit Matrix

| Family | Source | Relationship Fit | Candidate Edges | Shape Notes | Verdict |
| --- | --- | --- | --- | --- | --- |
| Flow containment | agent/workflow run lifecycle | Derived/materialized index over Pulse graph | `flow_contains`, `origin_of` | Flow id can be an index endpoint if it never gains Pulse fields/lifecycle. | Strong fit |
| Parent/child execution | model call, tool call, workflow step | Purpose-named edge | `parent_of` | Must avoid overloading parent with external parent, resume, thread order, delegation, or scoped applicability. | Strong fit |
| Temporal sequence | streaming chunks, step order, message order | Relationship or sequence metadata | `next_pulse`, `previous_context_item`, `next_context_item` | Source code already works around timestamp collisions; timestamps are not enough. | Strong fit |
| Thread order | conversation turns | Flow-to-flow relationship | `previous_flow`, `thread_contains_flow` | `nextFlowId` should be derivable. | Strong fit |
| Resume | suspended workflow/agent continuation | Purpose-named lineage edge | `resume_of` | Existing metadata already separates `resumedFromSpanId`; should not be encoded as ordinary parentage. | Strong fit |
| External trace bridge | ambient parent/span correlation | Purpose-named edge to external ref | `external_parent` | Carries PR #20499 lesson directly. | Strong fit |
| Subagent delegation | agent calls another agent | Purpose-named delegation edge | `subagent_of`, `delegates_to` | Need to distinguish containment from actor/delegation relation and inner delegated run id. | Strong fit |
| Provider/client tool bridge | provider-executed or client-executed tool | Late relationship / bridge edge | `provider_tool_result_of`, `client_tool_bridge` | Parentage can be known late or intentionally anchor outside model step lifecycle. | Mixed |
| Definition use | config/tool/schema/settings refs | Purpose-named edges | `uses_config_version`, `uses_tool_definition`, `validated_against` | Main dependency from Exploration 04. Direct edges for explicit acts. | Strong fit |
| Scoped definition applicability | active tools/settings override | ChangePulse to definitions | `enables_definition`, `disables_definition` | Later uses can be inferred/materialized; avoid copying inherited refs everywhere. | Strong fit |
| Content introduction | user input, memory pull, model output, tool output | Pulse owns content | `introduced_content` | Relationship may point from Pulse to content ref, or content may live inline. | Strong fit |
| Context removal/replacement | truncation/compaction/message removal | ChangePulse plus content edges | `removed_content`, `replaced_content`, `compacted_to` | Tests whether snapshots can be avoided conceptually. | Strong fit |
