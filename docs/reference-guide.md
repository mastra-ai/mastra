# Mastra Reference Documentation

This is a guide for community members (and LLMs!) for creating new reference docs and editing existing ones.

Mastra organizes its reference documentation in folders with the same structure as its core concepts: `CLI`,`LLMs and Models`, `Agents`, `Engines`, `RAG`, `Observability`. Each function gets its own page, such as `src/pages/reference/agents/createTool.mdx`.

We try to stay away from creating classes because it's not very TypeScript-y, but they get their own pages too.

Below is a guide for reference documentation on a function. They illustrate `Parameters` and `Returns`, using a <PropertiesTable> component to list options, types, and defaults.

---

## 1. Title and Brief Description

Start each reference page with a clear title and a short paragraph describing what the function, class, or feature does and why a user might need it.

```markdown
# MyFunction Reference

The MyFunction utility in Mastra allows you to transform data before passing it to the engine.
```

---

## 2. Usage Example

Provide a concise usage example or code snippet that shows how to import and use this function or feature in a typical Mastra project.

```typescript
import { MyFunction } from "@mastra/core";

const result = MyFunction({
  data: "some data",
  options: {
    verbose: true,
  },
});
```

---

## 3. Parameters

Under a “Parameters” heading, list the function’s input parameters, including any nested properties. Use the <PropertiesTable> component to provide structured information about each parameter, such as its type, whether it’s optional, and default values.

For example:

```mdx
## Parameters

<PropertiesTable
  content={[
    {
      name: "data",
      type: "string",
      description: "The input data to be transformed.",
      isOptional: false,
    },
    {
      name: "options",
      type: "object",
      description: "Additional options that modify the behavior of MyFunction.",
      isOptional: true,
      defaultValue: "{}",
    },
  ]}
/>
```

If the `options` object has its own properties, you can create a separate <PropertiesTable> to describe them:

```mdx
### options

<PropertiesTable
  content={[
    {
      name: "verbose",
      type: "boolean",
      description: "Enables detailed logging when 'true'.",
      isOptional: true,
      defaultValue: "false",
    },
  ]}
/>
```

---

## 4. Returns

If your function (or class method) returns a value, create a “Returns” heading. Briefly describe what the function returns and use <PropertiesTable> if the returned object has additional properties.

```mdx
## Returns

<PropertiesTable
  content={[
    {
      name: "transformedData",
      type: "string",
      description:
        "The final transformed data after applying the function logic.",
    },
    {
      name: "metadata",
      type: "object",
      description: "Additional information about the transformation.",
    },
  ]}
/>
```

## 5. Additional Notes or Examples

If there are advanced use cases, edge cases, or performance considerations, add them in a separate section. Consider referencing relevant files or sections of code if they provide additional clarity.

````markdown
## Additional Examples

For a more advanced usage, see “transformDataSync” in the following file:

```ts filename="src/examples/advancedUsage/transformDataSync.ts"
import { MyFunction } from "@mastra/core";

export async function transformDataSync(data: string) {
  const result = await MyFunction({
    data,
    options: { verbose: false },
  });
  return result;
}
```
````

## 6. Cross-Link to Related Docs

Where possible, link to any other relevant references—like other methods or classes that work closely with the feature. This helps users discover related functionality.

```markdown
### Related

- [Engine Configuration](/guide/reference/engine.mdx)
- [Agent Class Reference](/guide/reference/agent.mdx)
```

## Conclusion

By consistently following these guidelines, you ensure that Mastra’s reference documentation remains clear, easy to navigate, and provides all the essential details community members need to use Mastra effectively.

- Start with a concise **description**.
- Provide a **usage example**.
- Present **parameters** in a <PropertiesTable>.
- Show **returns** in another <PropertiesTable> (if applicable).
- Include **additional examples** or **notes** for advanced usage.
- **Cross-link** to relevant sections or features.
