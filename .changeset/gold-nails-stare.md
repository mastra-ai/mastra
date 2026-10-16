---
'@mastra/server': minor
---

Agent and tool responses now include `ui.studioComponent`, the ID of the custom Studio component built for the tool. Values that are not a build-generated ID, such as an inline component function, are left out of the response.
