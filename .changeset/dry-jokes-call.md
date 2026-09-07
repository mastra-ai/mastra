---
'@mastra/factory': minor
---

Boards now own tool-result rules and the global Factory rules object is gone.

- `defineBoard({ tools })` declares tool-result handlers on the board whose seat produces the result. Work declares `submit_plan` (an approved plan advances Planning → Execute); Review declares none; custom boards inherit nothing. A tool result on a board that is not installed or does not declare the tool fires no rule.
- Removed `FactoryRules`, `defaultFactoryRules`, `builtInFactoryRules`, `mergeFactoryRuleOverrides`, `assertFactoryRules`, `resolveFactoryToolRule`, and the `@mastra/factory/rules/defaults` subpath. `new MastraFactory({ rules })` now throws with a migration hint.
- Added `MastraFactoryConfig.configVersion` (default `factory-config-v1`), the operator-maintained audit label previously set through `rules.version`. Rule contexts and transition results carry `configVersion` instead of `ruleSetVersion`; the storage column keeps its `rule_set_version` name.

Migration:

```ts
// before
new MastraFactory({ storage, rules: defaultFactoryRules({ version: 'v2', overrides: { tools: { my_tool: { onResult } } } }) });
// after
new MastraFactory({ storage, configVersion: 'v2', boards: [defineBoard({ ..., tools: { my_tool: { onResult } } })] });
```
