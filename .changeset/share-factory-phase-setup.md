---
'@mastra/playground-ui': minor
---

Added Factory's column-header phase setup to `@mastra/playground-ui/domains/factory`: `PhaseSetup` (the rules, agent, auto-start and exit-tool icons that link to a phase's settings) and `PhaseSetupHoverCard` (the one hover card every header shares).

```tsx
const handle = createHoverCardHandle<string>();

<PhaseSetup handle={handle} phaseId="build" href="/config/build" summary="Build runs coding." arriving={2} agent autoStart={false} exitTool={false} LinkComponent={Link} />
<PhaseSetupHoverCard handle={handle}>{phaseId => <PhaseSetupCard {...cardProps(phaseId)} />}</PhaseSetupHoverCard>
```
