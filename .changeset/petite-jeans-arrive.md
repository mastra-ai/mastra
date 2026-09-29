---
'@mastra/playground-ui': minor
---

Added a `@mastra/playground-ui/lib/framework` entrypoint with `LinkComponentProvider` and `useLinkComponent`. Apps can pass their router's link component, `navigate` function and route paths to Studio components through the provider, so the components navigate with the app's own router.

```tsx
import { LinkComponentProvider, useLinkComponent } from '@mastra/playground-ui/lib/framework';

<LinkComponentProvider Link={Link} navigate={navigate} paths={paths}>
  <App />
</LinkComponentProvider>;

const AgentLink = ({ agentId }: { agentId: string }) => {
  const { Link, paths } = useLinkComponent();
  return <Link href={paths.agentLink(agentId)}>Open agent</Link>;
};
```
