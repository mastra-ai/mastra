---
'@mastra/memory': patch
---

Fixed the tool-call context available to Observational Memory observers.

- Completed calls now retain their arguments and outcomes, including the name of an activated skill.
- Large arguments use bounded, structure-aware previews so one value cannot hide other fields.
- Token accounting includes completed-call arguments, allowing observation to activate at the correct threshold.
- The default non-multimodal tool-result text cap is now 5,000 tokens, keeping the total Observer input budget stable with the restored arguments.
