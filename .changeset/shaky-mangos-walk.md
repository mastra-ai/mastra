---
'@mastra/datadog': patch
---

Fixed Datadog tag formatting to correctly parse 'key:value' format tags. Previously, tags like 'instance_name:career-scout-api' were sent as { 'instance_name:career-scout-api': true }, causing Datadog to render them as 'instance_name:career-scout-api:true'. Tags are now properly split into { key: 'value' } pairs.
