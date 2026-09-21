---
'@mastra/inngest': patch
'@mastra/core': patch
---

Fixed delegation bail() taking one extra model turn on the evented engine. When an onDelegationComplete hook calls ctx.bail(), the supervisor loop now stops in the same iteration on every engine. Previously the bail signal was passed between workflow steps by mutating a shared request context, which only works when all steps run in one process — on the evented engine each step gets its own copy, so the loop made one more model request before stopping. The bail signal now travels on the tool call step's serialized output, which crosses process and event boundaries reliably. The Inngest agentic loop's continuation predicate now also honors this flag, so bail() stops Inngest-hosted supervisor loops in the same iteration too (previously it only stopped via maxSteps).
