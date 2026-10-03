---
title: JSX-Returning Helpers Must Be Components
impact: MEDIUM
impactDescription: lowercase render helpers blur component boundaries, bypass React naming conventions, and attract repeated review comments
tags: structure, components, naming, jsx, maintainability
---

## JSX-Returning Helpers Must Be Components

Any reusable function that returns JSX should be a PascalCase component. Lowercase helpers are for computing values, formatting data, or building props. A helper named `renderX` that returns JSX is a component in practice, so name it and call it like one.

**Incorrect:**

```tsx
const renderJsonCodeBlock = (value: unknown, testId: string) => (
  <div data-testid={testId}>
    <CodeBlock code={JSON.stringify(value, null, 2)} lang="json" />
  </div>
);

export function ToolBadge({ result }: ToolBadgeProps) {
  return <section>{renderJsonCodeBlock(result, 'tool-result')}</section>;
}
```

**Correct:**

```tsx
function JsonCodeBlock({ value, testId }: { value: unknown; testId: string }) {
  return (
    <div data-testid={testId}>
      <CodeBlock code={JSON.stringify(value, null, 2)} lang="json" />
    </div>
  );
}

export function ToolBadge({ result }: ToolBadgeProps) {
  return (
    <section>
      <JsonCodeBlock value={result} testId="tool-result" />
    </section>
  );
}
```

Use a lowercase helper only when it does not return JSX:

```tsx
const formatJson = (value: unknown) => JSON.stringify(value, null, 2) ?? String(value);
```

Smell to catch in reviews: `renderSomething(...)` returning JSX, especially when it accepts props-like arguments or is reused in multiple JSX branches.
