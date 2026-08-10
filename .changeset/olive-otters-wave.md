---
'@mastra/daytona': minor
---

Added `domainAllowList` to `DaytonaSandboxOptions`, for allowing outbound access to services whose IP addresses change, such as package registries and hosted APIs. CIDR-based `networkAllowList` cannot express these reliably.

```typescript
const sandbox = new DaytonaSandbox({
  networkBlockAll: true,
  domainAllowList: 'registry.npmjs.org,*.githubusercontent.com',
});
```

The option is applied at sandbox creation and preserved by `clone()`. Requires `@daytonaio/sdk` 0.201.0 or later, which the package now depends on.
