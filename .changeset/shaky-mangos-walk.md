---
'@mastra/datadog': patch
---

Fixed Datadog trace tags being formatted incorrectly. Tags using the standard `key:value` format (e.g. `instance_name:career-scout-api`) were having `:true` appended to the value in the Datadog UI, resulting in `career-scout-api:true` instead of `career-scout-api`. Tags are now correctly split into proper key-value pairs before being sent to Datadog's LLM Observability API.
