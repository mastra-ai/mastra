# Harness Spec Brainstorming Instructions

This directory is the working area for Harness v1 spec issues. The source of
truth is the split files under `sections/`, plus the issue tracker in
`issues/`.

## Required Reading

Before tackling a Harness issue or making a material spec change, read:

- `issues/README.md`
- `INSTRUCTIONS.md`
- `ORCHESTRATOR.md`
- `HOW_TO_USE_CLIS.md`
- `OBJECTIVES.md`
- the relevant files under `sections/`

For issue work, inspect both `issues/open/` and `issues/close/` before editing.

Do not inspect `reference/`, `examples/`, or `sections/12-usage-examples/`
unless the user explicitly asks.

## Orchestrator Rule

The active Codex session is the only writer. Other models may be used only as a
read-only council through the CLI workflow in `HOW_TO_USE_CLIS.md`; they must
not edit files.

Before writing, scope the change:

- user goal
- relevant `sections/` files
- affected objectives and invariants
- related open and closed issues
- current Mastra source paths needed for verification
- narrowest files that should change

Prefer the smallest section change that resolves the invariant. Reuse canonical
terms and section owners. If a fix overlaps another concept, update the
canonical owner and cross-reference it instead of introducing a parallel
concept.

## Council Requirement

Run the full CLI council for non-trivial Harness v1 spec work. Treat closing or
resolving an issue as non-trivial unless it is clearly metadata-only or
editorial.

Full council means:

- Claude CLI reviewer with the default configured model
- OpenCode CLI reviewer using `google-vertex/gemini-3.1-pro-preview-customtools` with the
  `high` variant and Vertex env vars
- Codex CLI reviewer using `gpt-5.5` with high reasoning
- OpenCode CLI reviewer using `deepseek/deepseek-v4-pro` with the `max` variant
- OpenCode CLI reviewer using `alibaba-coding-plan/qwen3.6-plus` (Alibaba
  Coding Plan provider, no variant flag)
- OpenCode CLI reviewer using `xai/grok-4.3` with the `high` variant

Read `HOW_TO_USE_CLIS.md` immediately before running council and follow its
prompt template, command forms, model selectors, and failure handling. Keep raw
council output outside the repo, for example under `/private/tmp`.

Before launching the full council, preflight each reviewer command for
non-interactive use, including every OpenCode model selector.
Run the `Preflight Checklist` in `HOW_TO_USE_CLIS.md`, record each reviewer as
ready or blocked, and only then start the real review prompt. If a reviewer
prompts for login, browser authorization, or an API key, do not proceed with
that prompt unless the user explicitly authorizes the interactive login flow;
stop it, mark the reviewer unavailable for that turn, and report the blocker.

If a required CLI is unavailable, a model selector fails, or council is skipped
because the change is editorial, report that explicitly in the final update.

Council output is advisory. Classify useful claims as `accept`, `adapt`,
`reject`, or `conflict`, then verify accepted/adapted claims locally before
editing.

## Issue Workflow

For every issue task:

1. Reverify the issue against current `sections/` text.
2. Check related open and closed issues for overlap, prerequisites, and
   dependents.
3. Inspect current Mastra code paths when the spec claim depends on existing
   runtime behavior.
4. Run council when the issue resolution changes a contract, storage shape,
   recovery behavior, API, event channel, scheduler behavior, runtime semantics,
   server integration, or migration guarantee.
5. Edit the relevant `sections/` source of truth first.
6. Update issue relationships.
7. If resolved, move the issue from `issues/open/` to `issues/close/`, update
   `Status`, update `Tags`, and add a resolution note citing the section or code
   changes.

Do not close an issue solely because the issue file was edited. The section
source of truth must be updated, rejected, or explicitly deferred.

## Verification

Use focused text and diff checks for spec-only changes, such as `rg`, `sed`,
and `git diff --check`. Do not run broad monorepo builds or tests for spec-only
edits.

For package or implementation changes outside this directory, follow the
nearest package `AGENTS.md`, run the narrowest relevant build/test/typecheck,
and follow the repo changeset instructions when required.
