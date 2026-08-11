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

## Dynamic Tags: Put the Level in Context, Not the Tag

The mirror case is a PascalCase binding that is *not* a component. Choosing the tag at runtime is a normal pattern and stays one: an `as` prop, a ternary between literal tags, a lookup in a const map, and a template literal all render fine and keep their state.

One form does break. A tag read off a context trips `react-hooks/static-components` with `Cannot create components during render`, because passing a component through context is itself a real pattern, so the rule cannot tell a tag name from a component. Naming the value first does not help — the rule follows the assignment.

**Incorrect:**

```tsx
const HeadingTagContext = createContext<'h2' | 'h3'>('h3');
const Heading = useContext(HeadingTagContext); // a tag name, read as a component
```

**Correct:**

```tsx
const HeadingLevelContext = createContext<2 | 3>(3);
const headingLevel = useContext(HeadingLevelContext);
const Heading = headingLevel === 2 ? 'h2' : 'h3';
```

Carry the level and let the component pick the tag. The ternary is what proves the value is a host tag, and the context now describes the document outline instead of naming an element on the consumer's behalf.

Smell to catch in reviews: a capitalized binding assigned straight from `useContext` and used as JSX; a context typed as a tag name.
