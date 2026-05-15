---
'@mastra/core': major
---

Adds support for defining Harness v1 skills directly in `new Harness({ skills: [...] })`.

Configuration-defined skills are available to every session without requiring workspace setup. They resolve by `name` and take precedence over workspace skills with the same name.

Configuration-defined skill metadata must contain only primitives, arrays, and plain objects. This prevents returned skill descriptors from sharing mutable class instances with the original Harness config.

Skill argument validation is stricter. `metadata.args` schemas reject unsupported or malformed fields before dispatch, and supplied args must be JSON-serializable. Supported schema fields are `required`, `properties`, `type`, `enum`, `items`, and boolean `additionalProperties`.

Existing workspace skills that declare unsupported JSON-schema-like fields such as `pattern`, `minimum`, or `minLength` should remove those fields or move that validation into the skill prompt before calling `session.skills.use()`.

**Before**

- Workspace skill `metadata.args` could include unsupported schema-like fields and still reach execution.

**After**

- Unsupported or malformed `metadata.args` fields fail before execution with `HarnessSkillArgsValidationError`.
- Move constraints like `pattern`, `minimum`, and `minLength` into skill instructions or custom runtime validation.

```ts
const harness = new Harness({
  agents,
  modes,
  skills: [
    {
      name: 'triage',
      description: 'Classify a bug report before dispatch',
      instructions: 'Read the bug report and return a severity and owner.',
      metadata: {
        args: {
          required: ['ticketId'],
          properties: {
            ticketId: { type: 'string' },
          },
        },
      },
    },
  ],
});

const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
await session.skills.use('triage', { args: { ticketId: 'PF-350' } });
```
