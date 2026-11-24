---
'@mastra/playground-ui': minor
---

Added `AgentAvatarUpload` and `downscaleImageToDataUrl` under `@mastra/playground-ui/domains/agent-avatar`, so hosts other than Studio can let users pick an agent avatar. The image is downscaled in the browser and returned as a data URL.

```tsx
import { AgentAvatarUpload } from '@mastra/playground-ui/domains/agent-avatar';

<AgentAvatarUpload name={name} avatarUrl={avatarUrl} onChange={dataUrl => setAvatarUrl(dataUrl)} />;
```
