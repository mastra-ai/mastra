# Reference Documentation Guidelines

Guidelines for writing reference docs in `docs/src/content/en/reference/`.

Extracted from `agents/agent.mdx` (class doc) and `agents/generate.mdx` (method doc).

---

## Document Types

| Type       | Pattern        | Example                        |
| ---------- | -------------- | ------------------------------ |
| Class doc  | `agent.mdx`    | Constructor / class definition |
| Method doc | `generate.mdx` | Instance method                |

---

## Frontmatter

```yaml
# Class doc
---
title: 'Reference: {ClassName} | {Category}'
description: 'Documentation for the `{ClassName}` class in Mastra...'
packages:
  - '@mastra/{package}'
---
# Method doc
---
title: 'Reference: {Class}.{method}() | {Category}'
description: 'Documentation for the `{Class}.{method}()` method in Mastra...'
packages:
  - '@mastra/{package}'
---
```

---

## Section Order

### Class doc

1. `# {ClassName}` — one-sentence description
2. `## Usage examples` — multiple `###` sub-examples with titled code blocks
3. `## Constructor parameters` — `<PropertiesTable>`
4. `## Returns` — `<PropertiesTable>`
5. `## Related` — bullet list of internal links

### Method doc

1. `# {Class}.{method}()` — one-sentence description
2. `## Usage example` — single code block, multiple use cases via inline comments
3. `:::info` admonition (optional) — compatibility notes, caveats
4. `## Parameters` — `<PropertiesTable>` for top-level params
5. `### Options` — separate `<PropertiesTable>` for the options object
6. `## Returns` — `<PropertiesTable>`

---

## `<PropertiesTable>` Format

```tsx
<PropertiesTable
  content={[
    {
      name: "paramName",
      type: "TypeSignature",
      isOptional: true,           // omit or false for required
      description: "What it does.",
      properties: [               // nested sub-properties (optional)
        {
          parameters: [
            {
              name: "subParam",
              type: "SubType",
              isOptional: true,
              description: "...",
              properties: [...]   // can nest further
            },
          ],
        },
      ],
    },
  ]}
/>
```

### Rules

- Every param must have `name`, `type`, `description`
- `isOptional` — set to `true` for optional, omit or set `false` for required
- Nested objects use `properties > parameters` structure (can nest multiple levels)
- Shared constants can be spread into `content` arrays (e.g., `MODEL_SETTINGS_OBJECT`)

---

## Code Blocks

### Class doc — use `title` attribute

````markdown
```typescript title="src/mastra/feature/example.ts"
import { Thing } from '@mastra/core/thing'

export const thing = new Thing({
  id: 'my-thing',
})
```
````

### Method doc — no `title`, use inline comments

````markdown
```typescript
// Basic usage
const result = await agent.generate('hello')

// With options
const result = await agent.generate('hello', {
  maxSteps: 5,
})
```
````

### Ordering

- Simplest usage first, then progressively complex
- Always include imports in class doc examples
- Method doc examples can skip imports (already shown in class doc)

---

## Writing Style

- One-sentence intro under each `#` heading — what it is + what it does
- Descriptions are factual, no marketing language ("powerful", "easy", "production-ready")
- Use backticks for code references in descriptions (`` `name` ``, `` `generate()` ``)
- Mark deprecated items with `**Deprecated.**` prefix in description
- Cross-link related docs with `[text](/docs/path)` in descriptions when relevant

---

## Imports

Shared constants can be imported and reused across docs:

```tsx
import { MODEL_SETTINGS_OBJECT } from '@site/src/components/ModelSettingsProperties'

// Then spread into content arrays:
;<PropertiesTable content={[MODEL_SETTINGS_OBJECT, { name: 'other', type: 'string', description: '...' }]} />
```

---

## Checklist

- [ ] Frontmatter has `title`, `description`, `packages`
- [ ] H1 matches the class/method name exactly
- [ ] Usage examples come before parameter tables
- [ ] Every param has `name`, `type`, `description`; `isOptional` set correctly
- [ ] Nested objects use `properties > parameters` structure
- [ ] Returns section uses `<PropertiesTable>`
- [ ] Related links at bottom (class docs only)
- [ ] No marketing language in descriptions
- [ ] Code blocks show simplest usage first
