---
'@mastra/core': patch
---

Fix replay of OpenAI hosted `tool_search` (Responses API) so a completed
hosted search can be sent back to the model without a 400.

The Responses API returns a hosted `tool_search` as two items with different
ids — the call (`tsc_…`) and the output (`tso_…`). Three defects broke the
replay of that pair:

- Merging the tool-result into the stored tool part kept only one item id, so
  the next request referenced the same item twice: `400 Duplicate item found
  with id tso_…`.
- On cross-turn replay the `ModelMessage → DB` adapter dropped the
  provider-executed flag, so the result was moved into a `tool` role message
  and re-serialized as a client-mode `tool_search_output`: `400 No tool call
  found for tool search output with call_id tsc_…`.
- A hosted `tool_search` whose provider item ids were lost (e.g. a UI
  round-trip that strips `providerMetadata`) was replayed as an argument-less
  `tool_search_call` plus an orphaned `function_call_output`, both 400s.

Both item ids are now preserved through the merge, split back onto their own
tool-call/tool-result parts at prompt build, `providerExecuted` survives the
round-trip, and an unreplayable hosted `tool_search` is dropped so the model
re-discovers tools on the next turn.
