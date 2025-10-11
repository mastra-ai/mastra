---
title: "Reference: Workflow.commit() "
description: Documentation for the `.commit()` method in workflows, which re-initializes the workflow machine with the current step configuration.
---

# Workflow.commit()

The `.commit()` method re-initializes the workflow's state machine with the current step configuration.

## Usage

```typescript
workflow.step(stepA).then(stepB).commit();
```

## Returns

<PropertiesTable
  content={[
    {
      name: "workflow",
      type: "LegacyWorkflow",
      description: "The workflow instance",
    },
  ]}
/>

## Related

- [Branching Paths example](../../examples/workflows_legacy/branching-paths.md)
- [Workflow Class Reference](./workflow.md)
- [Step Reference](./step-class.md)
- [Control Flow Guide](../../docs/workflows-legacy/control-flow.md)
