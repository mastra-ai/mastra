---
'@mastra/playground-ui': minor
---

Added RuleCard and RuleLines, composable parts for rules that read as sentences (Where … and … → Move to …).

```tsx
<RuleCard>
  <RuleCardHeader>
    <RuleCardStep>If</RuleCardStep>
    <RuleCardTitle>Closed issues go to Done</RuleCardTitle>
  </RuleCardHeader>
  <RuleCardBody>
    <RuleLines role="group" aria-label="Conditions">
      <RuleLine>
        <RuleLineKeyword>Where</RuleLineKeyword>
        <RuleLineContent>…</RuleLineContent>
      </RuleLine>
    </RuleLines>
  </RuleCardBody>
  <RuleCardOutcome label="Move to">…</RuleCardOutcome>
</RuleCard>
```
