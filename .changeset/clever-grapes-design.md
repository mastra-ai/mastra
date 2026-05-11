---
'@mastra/playground-ui': minor
---

**Updated agent traces tab to use the rich observability traces UI**

The agent traces tab now shows the dense 7-column trace list with a side-panel detail view featuring colored timeline spans (Agent/Workflow/Model/Scorer), expandable nested spans, Evaluate Trace, and Save as Dataset Item.

**Locked scope filter pills**

When viewing agent-scoped traces, the Primitive Type and Primitive ID filter pills are now read-only — they display the agent context, show a lock icon and tooltip, and cannot be edited or removed. The Add Filter dropdown no longer lists scope-controlled fields so users cannot accidentally override the active scope.

`PropertyFilterApplied` accepts a new `lockedFieldIds` (and optional `lockedTooltipContent`) prop. `PropertyFilterCreator` accepts a new `hiddenFieldIds` prop. Both are opt-in and unset by default, so existing usages are unaffected.

```tsx
// Before
<PropertyFilterApplied fields={fields} tokens={tokens} onTokensChange={setTokens} />

// After — pills for the listed fields render locked with a tooltip
<PropertyFilterApplied
  fields={fields}
  tokens={tokens}
  onTokensChange={setTokens}
  lockedFieldIds={['rootEntityType', 'entityId']}
  lockedTooltipContent="This filter is set by the current context."
/>
```
