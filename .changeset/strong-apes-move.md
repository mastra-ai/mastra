---
'@mastra/playground-ui': patch
---

Fixed the filter bar adding a second chip for a field that already has one. On pages that keep one filter per field (Logs, Metrics, Traces), picking another value for an already filtered field now updates its chip instead of adding a chip that is silently ignored: values combine into "is any of" when the field supports it, otherwise the new value replaces the old one.

The Traces page also keeps "is any of" filters on Status and Primitive type in the URL. Before, they were dropped and the list stayed unfiltered.

Operators declare their multi-value form with the new `widensTo` option:

```ts
const operators = [
  { id: 'is', label: 'is', widensTo: 'in' },
  { id: 'in', label: 'is any of', arity: 'many' },
];
```
