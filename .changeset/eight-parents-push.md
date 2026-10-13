---
'@mastra/langfuse': minor
---

Added top-level observation metadata in Langfuse for scalar span attributes (string, number, or boolean), for example `stepIndex` and `isContinued` on model step spans. Observation-level LLM-as-a-Judge rules can now filter on them. No code change is needed:

```ts
import { Observability } from '@mastra/observability';
import { LangfuseExporter } from '@mastra/langfuse';

const observability = new Observability({
  configs: {
    langfuse: { exporters: [new LangfuseExporter()] },
  },
});
```

In Langfuse, filter an observation-level evaluator on `spanType` equals `model_step` and `isContinued` equals `"false"` to judge only the final step of each agent run. Attributes that hold objects or arrays, such as workflow `entryMetadata`, aren't promoted.
