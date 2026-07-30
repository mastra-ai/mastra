---
'@mastra/core': minor
---

`RegexFilterProcessor` now reports what the `redact` strategy rewrote, through the existing `Processor.onViolation` callback.

Redaction used to be silent. The processor found its matches, replaced the text, and dropped the match list, leaving nothing downstream to audit. It now reports once per redacted message, message part, or stream chunk, with offsets relative to that piece of text.

```ts
const filter = new RegexFilterProcessor({
  presets: ['pii'],
  strategy: 'redact',
});

filter.onViolation = async ({ detail }) => {
  const redaction = detail as RegexRedactionDetail;

  for (const entry of redaction.redactions) {
    await auditLog.write({
      phase: redaction.phase, // processInput | processOutputStream | processOutputResult
      messageId: redaction.messageId,
      rule: entry.rule, // 'credit-card'
      offset: entry.index,
      length: entry.length,
    });
  }
};
```

Async callbacks are awaited. When no callback is attached the redact path stays synchronous, so nothing changes for existing callers. When two rules match the same span, the winning rule is reported as `rule` and every rule that matched is listed in `overlappingRules`.

**Values are withheld by default**

Reports carry offsets and rule names, not the matched text. An audit trail that copies the data it protects widens the exposure it was added to narrow, which is why the `block` strategy already withholds matched text from its `TripWire` metadata. Set `includeRedactedValues: true` to add a `value` field when the destination is as protected as the original.
