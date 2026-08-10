# Source Plan

This pass should inspect source only after following the relevant package-local `AGENTS.md`.

Likely source areas:

## Core Agent Config And Versions

- `packages/core/src/storage/domains/agents/base.ts`
- `packages/core/src/storage/domains/agents/inmemory.ts`
- `packages/core/src/storage/domains/agents/filesystem.ts`
- `packages/core/src/storage/domains/agents/source.ts`
- `packages/core/src/storage/domains/versioned.ts`
- `packages/core/src/agent-builder/ee/picker.ts`
- `packages/core/src/agent-builder/ee/policy.ts`

Questions:

- Which durable fields act like definitions?
- Which fields already have version ids, hashes, version numbers, or changed-field metadata?
- Which operations are product/API boundary events versus storage internals?

## Runtime References

- `packages/core/src/agent/agent.ts`
- `packages/core/src/agent/message-list/message-list.ts`
- `packages/core/src/agent/message-list/state/MessageStateManager.ts`
- `packages/core/src/tools/*`
- model call / LLM routing files identified during source search

Questions:

- Where are instructions, tools, schemas, and model settings selected for a run?
- Could runtime Pulses reference stable definitions without duplicating bodies?
- Where do runtime overrides appear?

## Tool Definitions And Schemas

- tool execution and validation surfaces found by source search
- tool provider / integration surfaces from prior audit files

Questions:

- Is input schema part of a tool definition, its own definition, or both?
- Are generated/runtime-local schemas common enough to need temporary definitions?

## Existing Audit Inputs

- `pulse/code_audit/08-runtime-surfaces-pulse-candidates.md`
- `pulse/code_audit/10-protocol-telemetry-adapter-pulse-candidates.md`
- `pulse/code_audit/12-harness-agent-config-pulse-candidates.md`

