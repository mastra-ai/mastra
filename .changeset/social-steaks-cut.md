---
'@mastra/playground-ui': patch
---

Fix playground white screen when Zod discriminatedUnion is intersected using `and()`.
This now works, but zod validation will fail, please use `extend` instead

Instead of 

```
z.discriminatedUnion('type', [
  z.object({ type: z.literal('byCity'), city: z.string() }),
  z.object({ type: z.literal('byCoords'), lat: z.number(), lon: z.number() }),
]).and(
  z.object({ order: z.number() })
)
```

do

```
z.discriminatedUnion('type', [
  z.object({ type: z.literal('byCity'), city: z.string() }).extend({ order: z.number() }),
  z.object({ type: z.literal('byCoords'), lat: z.number(), lon: z.number() }).extend({ order: z.number() }),
]);
```
