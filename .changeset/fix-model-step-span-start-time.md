---
"@mastra/observability": patch
---

fix(tracing): correct span timing when step-start events arrive late

**The problem:** When step-start events arrived after other tracing events (like token generation), a new step span was incorrectly created, duplicating the span and corrupting the parent-child relationships. This made trace timings inaccurate.

**The fix:** Step spans are now reused and updated when late-arriving step-start events occur, preserving the correct start time and maintaining proper span hierarchy. Traces now show accurate durations and relationships for model steps, even when events arrive out of order.

Fixes #11271