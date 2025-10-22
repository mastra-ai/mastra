---
title: 'Mastra.getLogger() '
description: 'Documentation for the `Mastra.getLogger()` method in Mastra, which retrieves the configured logger instance.'
---

# Mastra.getLogger()

The `.getLogger()` method is used to retrieve the logger instance that has been configured in the Mastra instance.

## Usage example

```typescript copy
mastra.getLogger();
```

## Parameters

This method does not accept any parameters.

## Returns

<PropertiesTable
content={[
{
name: "logger",
type: "TLogger",
description: "The configured logger instance used for logging across all components (agents, workflows, etc.).",
},
]}
/>

## Related

- [Logging overview](../../docs/observability/logging)
- [Logger reference](../../reference/observability/logger)
