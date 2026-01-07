---
'@mastra/observability': patch
---

Fix trace-level sampling to sample entire traces instead of individual spans

Previously, sampling decisions were made independently for each span, causing fragmented traces where some spans were sampled and others were not. This defeated the purpose of ratio or custom sampling strategies.

Now:
- Sampling decisions are made once at the root span level
- Child spans inherit the sampling decision from their parent
- Custom samplers are only called once per trace (for root spans)
- Either all spans in a trace are sampled, or none are

Fixes #11504
