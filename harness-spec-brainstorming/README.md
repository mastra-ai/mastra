# Harness Spec Brainstorming

This folder is the working area for the Harness v1 section specs. The section files are the editable source of truth.

- `sections/` contains the spec by topic. Work directly in these files.
- `INSTRUCTIONS.md` defines the single-orchestrator rules for future Harness changes.
- `HOW_TO_USE_CLIS.md` is mandatory reading before using Claude, OpenCode Gemini, Codex, OpenCode DeepSeek, OpenCode Qwen, or OpenCode Grok council. Codex CLI review must use `gpt-5.5` with high reasoning; OpenCode Gemini must use `google-vertex/gemini-3.1-pro-preview-customtools` with the `high` variant and Vertex env vars; OpenCode DeepSeek review must use the `max` variant; OpenCode Qwen review must use `alibaba-coding-plan/qwen3.6-plus` with no variant flag; OpenCode Grok review must use `xai/grok-4.3` with the `high` variant.
- `IMPLEMENTATION_READINESS.md` maps the checked spec to current Mastra code gaps and the next implementation project phases.
- `issues/` tracks open and closed claim files. Its README defines the skepticism, relevance, and relationship rules for maintaining issue state.
- `ORCHESTRATOR.md` describes the repeatable scope, council, verification, write, and iteration loop.
- `OBJECTIVES.md` defines the quality gates future Harness work should satisfy.
