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

## Dynamic Tags: Pick One, Don't Build One

The mirror case is a PascalCase binding that is *not* a component. When the tag depends on a prop or on context, choose between literal tags — never assemble the tag name. A built name widens to `string`, so it needs an `as const` just to be usable as JSX, and the React Compiler lint reads any opaque capitalized binding in tag position as a component created during render (`Cannot create components during render`).

**Incorrect:**

```tsx
const Heading = `h${level}` as const; // the assertion exists only to stop the widening
const Heading = useContext(HeadingContext); // opaque to the compiler, so assumed to be a component
```

**Correct:**

```tsx
const Heading = level === 2 ? 'h2' : 'h3';
```

The ternary infers `'h2' | 'h3'`, which the compiler recognises as host tags, and nothing has to be asserted. Returning real elements from each branch (`<h2>…</h2>` / `<h3>…</h3>`) is also correct, at the cost of duplicating the attributes.

Smell to catch in reviews: a template literal or lookup producing a tag name; `as const` on a computed tag; a capitalized binding assigned straight from a hook call and used as JSX.
