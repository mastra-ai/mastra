---
'@mastra/code-sdk': patch
'mastracode': patch
---

Mastra Code no longer opens Knowledge storage at startup unless Knowledge is turned on, so existing databases keep working when the experimental Subconscious flag is off. When Knowledge is on but its storage cannot be opened (for example, a database that still holds older Knowledge tables), Mastra Code starts anyway and `/knowledge` explains why it is unavailable.

```ts
const code = await createMastraCode();
if (!code.knowledgeInspector) {
  console.log(code.knowledgeInspectorUnavailableReason);
}
```
