---
'@mastra/playground-ui': minor
---

Added rule-building options to `FilterBar`. Each one is opt-in, so existing bars behave as before.

- `negatable`: a **not** toggle on every chip and in group editors. Negated nodes carry `negated: true`.
- `customField`: offers a typed name the field list doesn't have, under a prefix such as `metadata.`.
- `validateItem`: marks a chip invalid with your message. It receives where the chip sits (negated, scope, group).
- `operatorsFor`: narrows the operators a field offers at a place, for example no word search under a negation. A chip whose operator is ruled out reads invalid.
- `rootLogicToggle`: an `and` / `or` toggle between root chips when the value is an expression.
- `scopes` and `maxScopedGroups`: related clauses such as **Has spans** / **Has no spans**, with their own fields and quantifiers.

Traces also get `tracePredicateToExpression`, `expressionToTracePredicate` and `traceOperatorsFor` to edit a `TraceQuery` `where` predicate in a `FilterBar`:

```tsx
import {
  expressionToTracePredicate,
  traceOperatorsFor,
  tracePredicateToExpression,
} from '@mastra/playground-ui/domains/traces/trace-predicate-expression';

// No predicate yet: start from an empty bar.
const expression = where ? tracePredicateToExpression(where) : { logic: 'and', nodes: [] };

// `undefined` means the bar can't show this predicate (for example, a literal on the left).
// Keep `where` as it is instead of editing an empty bar, which would drop it on the first change.
if (!expression) return <RawPredicate where={where} />;

<FilterBar
  fields={fields}
  operators={operators}
  value={expression}
  onValueChange={next => setWhere(expressionToTracePredicate(next))}
  negatable
  rootLogicToggle
  scopes={scopes}
  operatorsFor={traceOperatorsFor}
/>;
```
