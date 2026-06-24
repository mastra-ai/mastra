---
'@mastra/core': patch
---

Fixed channel rendering on serverless runtimes (Vercel, AWS Lambda, Cloudflare Workers, Netlify).

**No more duplicate replies.** On serverless, the same webhook event can be processed by multiple concurrent invocations. Previously each one rendered the agent reply independently, producing duplicate messages. Now only the invocation that wins the run lease renders — losers resolve cleanly without posting.

**Runs no longer get killed mid-flight.** The channel handler now keeps the serverless invocation alive until the agent run finishes, instead of returning immediately and relying on a background subscription that gets frozen.

**Multi-step replies fully render.** Agents that make multiple LLM calls per run (e.g. tool use → follow-up) now render every step's text instead of only the first.

**Tool approval buttons now appear on all rendering paths.** Previously, tool approval prompts (approve/deny buttons) could fail to render when using output processors. Fixed by routing `tool-call-approval` chunks through the output processor pipeline.

**Tool approval and decline use the same rendering path as regular messages.** Approval and decline actions now flow through the per-run output processor instead of a separate subscription-based path, making rendering consistent across all message types.

**User output processors now run before channel rendering.** User-configured output processors (e.g. PII redaction, translation) now transform chunks before the channel renders them to the platform, instead of after.

**Concurrency strategy switched to `concurrent`.** The chat-sdk queue lock could get stuck in frozen serverless invocations. Ordering is now handled by the signals/lease layer, removing the stale-lock failure mode.
