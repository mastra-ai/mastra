---
'@mastra/server': minor
---

Allow stored Responses API follow-up requests to use `previous_response_id` without also passing `agent_id`.

When callers pass both `previous_response_id` and an explicit `agent_id`, mismatched agents now return a clear 400 response instead of looking like a missing stored response.

The create-response schema now also rejects empty `agent_id` and `previous_response_id` strings.
