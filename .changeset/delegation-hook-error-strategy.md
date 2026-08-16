---
'@mastra/core': minor
---

Added `hookErrorStrategy` to `DelegationConfig`, an opt-in strategy for how errors thrown by the `onDelegationStart` and `onDelegationComplete` delegation lifecycle hooks are handled.

Previously, both hooks silently logged a thrown error and continued as if the hook had not thrown — a throwing `onDelegationStart` could never actually block a delegation, and a throwing `onDelegationComplete` left the delegation looking successful even though the hook's own result handling never ran. This default ("warn") behavior is unchanged.

Setting `hookErrorStrategy: 'throw'` opts into fail-closed behavior: a throwing `onDelegationStart` now aborts the delegation before the sub-agent is invoked, and a throwing `onDelegationComplete` marks the delegation as failed, propagating the hook's error the same way a sub-agent execution failure would.
