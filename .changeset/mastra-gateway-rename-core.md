---
'@mastra/core': minor
---

Renamed the built-in Mastra gateway display name from **Memory Gateway** to **Mastra Gateway**, and decoupled memory handling from the gateway's identity.

Model gateways can now declare whether they manage memory server-side through a new `handlesMemory()` capability. Memory behavior is driven by this capability instead of being inferred from the gateway id, and resolved models expose it as `gatewayHandlesMemory`.

**Why:** A gateway is a model router; Observational Memory is a separate feature the hosted Mastra gateway adds. Inferring memory from the gateway id meant routing through the gateway only to switch models could silently skip local memory.

**Custom gateways**

```ts
import { MastraModelGateway } from "@mastra/core/llm";

class MyGateway extends MastraModelGateway {
  readonly id = "my-gateway";
  readonly name = "My Gateway";

  // Opt in only if your gateway observes and stores memory server-side
  override handlesMemory(): boolean {
    return true;
  }
  // ...rest of the gateway implementation
}
```
