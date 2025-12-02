---
'@mastra/playground-ui': patch
---


Added tracing options to workflow runs and agent generate / stream / network. You can now configure tracing options, custom request context keys, and parent trace/span IDs through a new "Tracing options" tab in the workflow/agent ui UI.

**Usage:**

The workflow settings are now accessible via the new `useTracingSettings` hook and `TracingSettingsProvider`:

```tsx
import { TracingSettingsProvider, useWorkflowSettings } from '@mastra/playground-ui';

// Wrap your workflow components with the provider
<TracingSettingsProvider entityId="my-workflow" entityType="workflow">
  <YourWorkflowUI />
</TracingSettingsProvider>

// Access settings in child components
const { settings, setSettings } = useTracingSettings();

// Configure tracing options
setSettings({
  tracingOptions: {
    metadata: { userId: '123' },
    requestContextKeys: ['user.email'],
    traceId: 'abc123'
  }
});
```

Tracing options are persisted per workflow/agent in localStorage and automatically applied to all workflow/agent executions.
