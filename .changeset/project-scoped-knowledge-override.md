---
'@mastra/memory': patch
'@mastra/code-sdk': patch
---

Subconscious knowledge scope resolution now honors a knowledgeResourceId request context override, letting a host anchor the resource rung on a shared id instead of the run's resourceId. Mastra Code sets it from the factory project id so factory work sessions of one project share entities, facts, and pins, and enables Subconscious pins in factory memory.
