---
'@mastra/fastembed': minor
---

Fixed fastembed starving its host under a CPU limit. ONNX Runtime sized its thread pool from the machine's cores and busy-waited idle threads, so in a container limited to a few CPUs on a larger host it used the whole quota and the kernel paused the process. Under a CPU limit the pool now follows the CPUs the process may use (`os.availableParallelism()`), and idle threads sleep. Without a limit, ONNX Runtime still picks the pool size (one thread per physical core). See #30736.

Added a way to set the thread count yourself, to leave CPU for the rest of the process or when the limit isn't visible to the process (for example a Kubernetes CPU request without a limit). Set `MASTRA_FASTEMBED_THREADS`, which applies to every FastEmbed model including `fastembed.small`, or pass `threads` when building a model yourself:

```ts
import { FlagEmbedding, EmbeddingModel } from '@mastra/fastembed';

const model = await FlagEmbedding.init({ model: EmbeddingModel.BGESmallENV15, threads: 2 });
```
