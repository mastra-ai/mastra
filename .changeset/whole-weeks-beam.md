---
'@mastra/core': major
---

Use tool's outputSchema to validate results and return an error object if schema does not match output results.

```typescript
const getUserTool = createTool({
id: "get-user",
outputSchema: z.object({
id: z.string(),
name: z.string(),
email: z.string().email(),
}),
execute: async (inputData) => {
return { id: "123", name: "John" };
},
});
```

When validation fails, the tool returns a `ValidationError`:

```typescript
// Before v1 - invalid output would silently pass through
await getUserTool.execute({});
// { id: "123", name: "John" } - missing email

// After v1 - validation error is returned
await getUserTool.execute({});
// {
//   error: true,
//   message: "Tool output validation failed for get-user. The tool returned invalid output:\n- email: Required\n\nReturned output: {...}",
//   validationErrors: { ... }
// }
```
