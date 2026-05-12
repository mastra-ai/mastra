# How To Use CLI Council

This workspace uses external CLI models as a read-only review council for
Harness v1 spec work. The active Codex session is the only writer. Council
models inspect scoped material, identify risks, and recommend changes. They do
not edit files.

Read this file before running Claude, OpenCode Gemini, Codex, OpenCode
DeepSeek, OpenCode Qwen, or OpenCode Grok council. Also read `INSTRUCTIONS.md`,
`OBJECTIVES.md`, `issues/README.md`, and the relevant files under `sections/`
before making material spec changes.

## Decision Rule

Run the full council for non-trivial Harness v1 spec changes. A change is
non-trivial when it affects any contract, storage shape, recovery behavior,
API, event channel, scheduler behavior, runtime semantics, server integration,
or migration guarantee.

The orchestrator can handle small editorial cleanups directly when no technical
claim changes.

## Required Reviewers

For non-trivial spec work, use all reviewers:

| Reviewer | Use For | Required Selector |
| --- | --- | --- |
| Claude CLI | broad design critique and contradiction hunting | default configured model |
| OpenCode CLI (Gemini via Google Vertex) | independent edge-case and gap review | `google-vertex/gemini-3.1-pro-preview-customtools` with the `high` variant and Vertex env vars |
| Codex CLI | strict spec review with repo-aware reasoning | `gpt-5.5`, high reasoning |
| OpenCode CLI (DeepSeek) | additional independent critical read | `deepseek/deepseek-v4-pro` with the `max` variant |
| OpenCode CLI (Qwen) | additional independent critical read | `alibaba-coding-plan/qwen3.6-plus` with no variant flag |
| OpenCode CLI (Grok via xAI) | additional independent critical read | `xai/grok-4.3` with the `high` variant |

Do not silently substitute reviewers or model IDs. If a CLI is unavailable, a
model selector fails, or a command needs a different configured model ID, report
that in the final update.

## Ground Rules

- Run council from this folder unless the prompt explicitly needs current
  Mastra implementation code from the parent repo.
- Do not inspect `examples/` or `reference/` unless the user explicitly asks.
- Keep prompts narrow. Name exact section files and claims under review.
- Tell every reviewer that its output is advisory and that it must not edit
  files.
- Ask for critical review, false positives, missing edge cases,
  contradictions, incomplete recovery logic, and diff-shaped recommendations.
- Keep raw council output outside the repo, for example under `/private/tmp`,
  only when a scratch transcript is useful. Do not commit raw council output.
- Independently verify every accepted claim against `sections/`,
  `OBJECTIVES.md`, `issues/`, and current Mastra code when the spec references
  existing behavior.

## Scope Checklist

Before running council, write down:

1. The user goal.
2. The files under `sections/` that are in scope.
3. The current claims that must be checked.
4. The objectives that must not regress.
5. Whether current Mastra implementation code is needed for verification.

Use `issues/` and the relevant `sections/` as the roadmap of claim checks and
unresolved Harness v1 work. A claim still needs verification against the section
specs and current Mastra code before it becomes part of the final design.

If implementation code is needed, run the relevant CLI from the parent repo and
state the exact source files it may inspect. Keep `examples/` and `reference/`
out of scope unless the user asked for them.

## Prompt Template

Use one prompt shape for all reviewers. Fill in the scope instead of asking a
model to browse the whole workspace.

```text
Read-only critical review. You are reviewing Harness v1 spec work in
/Users/mbenhamd/Project/mastra/harness-spec-brainstorming.

Do not edit files. Do not inspect examples/ or reference/ unless explicitly
listed in Scope. Your output is advisory only; the orchestrator will verify
claims before editing.

Read first:
- INSTRUCTIONS.md
- OBJECTIVES.md
- issues/README.md
- <relevant section files>

Scope:
- <specific files, claims, or proposed edits under review>

Check for:
- contradictions with the Harness v1 objectives
- false positives or unsupported claims
- missing edge cases
- incomplete recovery or concurrency logic
- API, storage, event, scheduler, runtime, or migration guarantees that need
  sharper wording

Return:
1. Findings ordered by severity, with file citations.
2. Missing edge cases.
3. Claims that need verification against current Mastra code.
4. Diff-shaped recommendations.
5. Explicit uncertainty where you cannot verify a claim.
```

For multi-line prompts, prefer writing the prompt to `/private/tmp` and passing
the file contents to each CLI. Keep the prompt file out of the repo.

## Commands

Run commands from the workspace root unless a command uses `-C` or `--dir`.
Before launching the full council, check that each reviewer command can run
non-interactively, including every OpenCode model selector. A reviewer that
prompts for login, browser authorization, or an API key is not usable for that
turn unless the user explicitly authorizes completing that login flow. Do not
answer `Y` to browser-login prompts or enter credentials on the user's behalf;
stop the process, mark the reviewer unavailable, and report it.

OpenCode Gemini uses Google Vertex through Application Default Credentials, not
`opencode /connect` or an API key. Run OpenCode Gemini commands with
`GOOGLE_CLOUD_PROJECT` and `VERTEX_LOCATION` set inline before `opencode`.
Before running OpenCode Gemini, verify that `GOOGLE_CLOUD_PROJECT` is set to
the Vertex project, `VERTEX_LOCATION` is set to the intended region or
`global`, and ADC can mint a token:

```sh
GOOGLE_CLOUD_PROJECT=mastravertex \
VERTEX_LOCATION=global \
gcloud auth application-default print-access-token >/dev/null

GOOGLE_CLOUD_PROJECT=mastravertex \
VERTEX_LOCATION=global \
opencode models | rg '^google-vertex/gemini-3.1-pro-preview-customtools$'
```

If those checks fail, mark OpenCode Gemini unavailable for that turn or ask the
user to complete the ADC/environment setup outside the council flow.

### Preflight Checklist

Before running the real council prompt, smoke-test each reviewer with a tiny
read-only prompt and capture output under `/private/tmp`. Record the result as
`ready` or `blocked` in your working notes.

```sh
claude auth status \
  > /private/tmp/harness-council-preflight-claude.out \
  2> /private/tmp/harness-council-preflight-claude.err
```

If Claude reports `Not logged in`, do not run the Claude council command. Mark
Claude as unavailable/auth-blocked.

```sh
GOOGLE_CLOUD_PROJECT=mastravertex \
VERTEX_LOCATION=global \
opencode run \
  --model google-vertex/gemini-3.1-pro-preview-customtools \
  --variant high \
  --dir /Users/mbenhamd/Project/mastra/harness-spec-brainstorming \
  "Read-only preflight. Return exactly: OK." \
  > /private/tmp/harness-council-preflight-opencode-gemini.out \
  2> /private/tmp/harness-council-preflight-opencode-gemini.err
```

If OpenCode Gemini asks for an API key, asks to connect a provider, or cannot
mint a Google access token, stop the process and mark OpenCode Gemini as
unavailable/auth-blocked. Do not use `/connect` for Google Vertex.

```sh
codex -m gpt-5.5 \
  -c model_reasoning_effort=high \
  -s read-only \
  -a never \
  -C /Users/mbenhamd/Project/mastra/harness-spec-brainstorming \
  exec --ephemeral "Read-only preflight. Return exactly: OK." \
  > /private/tmp/harness-council-preflight-codex.out \
  2> /private/tmp/harness-council-preflight-codex.err
```

If Codex fails with app-server, auth/cache, or `Operation not permitted`
errors, rerun the same read-only preflight with escalation. Do not switch model
IDs to make the run pass.

```sh
# OpenCode DeepSeek
opencode run \
  --model deepseek/deepseek-v4-pro \
  --variant max \
  --dir /Users/mbenhamd/Project/mastra/harness-spec-brainstorming \
  "Read-only preflight. Return exactly: OK." \
  > /private/tmp/harness-council-preflight-opencode-deepseek.out \
  2> /private/tmp/harness-council-preflight-opencode-deepseek.err

# OpenCode Qwen3.6-plus (Alibaba Coding Plan)
opencode run \
  --model alibaba-coding-plan/qwen3.6-plus \
  --dir /Users/mbenhamd/Project/mastra/harness-spec-brainstorming \
  "Read-only preflight. Return exactly: OK." \
  > /private/tmp/harness-council-preflight-opencode-qwen.out \
  2> /private/tmp/harness-council-preflight-opencode-qwen.err

# OpenCode Grok 4.3 (xAI)
opencode run \
  --model xai/grok-4.3 \
  --variant high \
  --dir /Users/mbenhamd/Project/mastra/harness-spec-brainstorming \
  "Read-only preflight. Return exactly: OK." \
  > /private/tmp/harness-council-preflight-opencode-grok.out \
  2> /private/tmp/harness-council-preflight-opencode-grok.err
```

If OpenCode fails with SQLite/local-state errors such as
`PRAGMA wal_checkpoint(PASSIVE)`, rerun the same read-only preflight with
escalation. If any OpenCode reviewer still fails before returning a usable
response, mark that reviewer unavailable and report the error class.

When running from Codex's sandbox, capture stderr to `/private/tmp` as well as
stdout. Claude, Codex CLI, and OpenCode reviewers may need access to local
auth/cache or SQLite state outside the workspace. If a reviewer fails with
sandbox-shaped errors such as `Operation not permitted`, inability to initialize
the Codex app-server client, or OpenCode `PRAGMA wal_checkpoint` failure, rerun
that same read-only reviewer with escalation rather than substituting another
model.
Report any reviewer that still cannot run.

For non-trivial spec work, run the required council before moving an issue to
`issues/close/`. If the issue was already closed before review, run council
immediately afterward and treat any accepted finding as a follow-up patch before
finalizing the turn.

Before counting a reviewer as completed, inspect both stdout and stderr. A CLI
can exit `0` while failing to read the scoped files; output containing messages
such as `File not found`, `cannot access`, empty findings after tool failures,
or a refusal to inspect the listed files is a failed reviewer run, not a clean
review. Rerun with the fallback listed for that CLI or explicitly report the
reviewer as unavailable in the final update.

### Claude

```sh
claude --permission-mode plan \
  --add-dir /Users/mbenhamd/Project/mastra/harness-spec-brainstorming \
  -p "$(cat /private/tmp/harness-council-prompt.txt)" \
  > /private/tmp/harness-council-claude.out \
  2> /private/tmp/harness-council-claude.err
```

If Claude exits with no stdout/stderr, exits `143`, or sits for several minutes
with both output files empty, do not count the run. Stop the process, confirm a
tiny `claude -p "Read-only preflight. Return exactly: OK."` prompt works, then
rerun the council with `--permission-mode plan`, `--add-dir`, and a narrower
scope if needed. Record the invalid transcript path in the final update.

### OpenCode Gemini

```sh
GOOGLE_CLOUD_PROJECT=mastravertex \
VERTEX_LOCATION=global \
opencode run \
  --model google-vertex/gemini-3.1-pro-preview-customtools \
  --variant high \
  --dir /Users/mbenhamd/Project/mastra/harness-spec-brainstorming \
  "$(cat /private/tmp/harness-council-prompt.txt)" \
  > /private/tmp/harness-council-opencode-gemini.out \
  2> /private/tmp/harness-council-opencode-gemini.err
```

OpenCode Gemini must use Vertex ADC, inline Vertex env vars, the
`google-vertex/gemini-3.1-pro-preview-customtools` model selector, and `--variant high`. If
it reports provider/auth errors, asks for an API key, or does not list
`google-vertex/gemini-3.1-pro-preview-customtools` in `opencode models`, do not treat the
run as successful. Confirm `GOOGLE_CLOUD_PROJECT`, `VERTEX_LOCATION`, and ADC
as described above; if the checks still fail, report OpenCode Gemini as
unavailable.

### Codex

Codex CLI review must use `gpt-5.5` with high reasoning. The `gpt-5.5` model
ID is intentional.

```sh
codex -m gpt-5.5 \
  -c model_reasoning_effort=high \
  -s read-only \
  -a never \
  -C /Users/mbenhamd/Project/mastra/harness-spec-brainstorming \
  exec --ephemeral "$(cat /private/tmp/harness-council-prompt.txt)" \
  > /private/tmp/harness-council-codex.out \
  2> /private/tmp/harness-council-codex.err
```

If the prompt needs current Mastra implementation context, set `-C` to the repo
root and state the allowed source paths in the prompt:

```sh
codex -m gpt-5.5 \
  -c model_reasoning_effort=high \
  -s read-only \
  -a never \
  -C /Users/mbenhamd/Project/mastra \
  exec --ephemeral "$(cat /private/tmp/harness-council-prompt.txt)"
```

### OpenCode

Run every OpenCode reviewer for the full council: Gemini 3.1 Pro Preview
through Google Vertex with the `high` variant and inline Vertex env vars,
DeepSeek V4 Pro with the `max` variant, Qwen3.6-plus from Alibaba Coding
Plan, and Grok 4.3 from xAI with the `high` variant. Capture each transcript
separately so the issue's Council block can classify them independently.

#### DeepSeek V4 Pro

```sh
opencode run \
  --model deepseek/deepseek-v4-pro \
  --variant max \
  --dir /Users/mbenhamd/Project/mastra/harness-spec-brainstorming \
  "$(cat /private/tmp/harness-council-prompt.txt)" \
  > /private/tmp/harness-council-opencode-deepseek.out \
  2> /private/tmp/harness-council-opencode-deepseek.err
```

#### Qwen3.6-plus (Alibaba Coding Plan)

The Alibaba Coding Plan provider must be authenticated with an API key. Verify
with `opencode models alibaba-coding-plan` before running.

```sh
opencode run \
  --model alibaba-coding-plan/qwen3.6-plus \
  --dir /Users/mbenhamd/Project/mastra/harness-spec-brainstorming \
  "$(cat /private/tmp/harness-council-prompt.txt)" \
  > /private/tmp/harness-council-opencode-qwen.out \
  2> /private/tmp/harness-council-opencode-qwen.err
```

Qwen3.6-plus does not support a `--variant` flag. Do not pass `--variant` when
using the Alibaba Coding Plan provider.

#### Grok 4.3 (xAI)

The xAI provider must be authenticated with an API key. Verify with
`opencode models xai` before running.

```sh
opencode run \
  --model xai/grok-4.3 \
  --variant high \
  --dir /Users/mbenhamd/Project/mastra/harness-spec-brainstorming \
  "$(cat /private/tmp/harness-council-prompt.txt)" \
  > /private/tmp/harness-council-opencode-grok.out \
  2> /private/tmp/harness-council-opencode-grok.err
```

Grok 4.3 must use `--variant high`. If xAI asks for an API key, asks to
connect the provider, does not list `xai/grok-4.3` in `opencode models`, or
fails before producing findings, do not treat the run as successful. Mark
OpenCode Grok unavailable for that turn and cite the stdout/stderr path.

If OpenCode fails before review with local state errors such as
`PRAGMA wal_checkpoint(PASSIVE)`, rerun once with `--print-logs --log-level
DEBUG` and capture stdout/stderr to `/private/tmp`; debug logging is extremely
verbose and should not stream into the main transcript. If the failure is
sandbox-shaped, rerun the same read-only command with escalation. If the retried
command still fails before producing findings, report OpenCode as unavailable
and cite the log path.

## Handling Results

Treat council output as input to the orchestrator, not as a patch queue.

Classify each useful claim:

| Class | Meaning |
| --- | --- |
| `accept` | cited, relevant, and consistent with objectives and section text |
| `adapt` | useful, but needs rewriting to fit the Harness v1 contract |
| `reject` | unsupported, stale, duplicative, out of scope, or inconsistent |
| `conflict` | plausible, but incompatible with current section text or another valid claim |

Only accepted or adapted claims should influence the final edit. Resolve
conflicts by reading the relevant section files and objectives directly; do not
let reviewer wording become the source of truth.

## Round 2 — Conflict Rebuttal

When Round 1 produces one or more `conflict` claims, run a single read-only
rebuttal round before final classification. Reviewers stay in their lanes — no
file edits, no scope expansion — but each one sees the contested claims from
the other reviewers and is asked to confirm, refute, or refine.

The rebuttal prompt must:

- name only the claims under dispute and cite the exact section files,
  `OBJECTIVES.md`, or issue files they touch;
- include the opposing reviewer's wording verbatim, attributed to the reviewer
  (Claude / OpenCode Gemini / Codex / OpenCode DeepSeek / OpenCode Qwen /
  OpenCode Grok), so each model can respond to the actual text rather than a
  paraphrase;
- ask each reviewer for cited agreement, cited disagreement, or a refined
  version, plus explicit uncertainty when it cannot verify;
- forbid edits, repeat the read-only constraint, and not reveal the
  orchestrator's draft classification.

Cap rebuttal at one round per issue or change. After Round 2, the orchestrator
re-classifies every claim with both the original findings and the rebuttals in
view, then verifies the remaining `accept` / `adapt` claims against `sections/`,
`OBJECTIVES.md`, `issues/`, and current Mastra code. A second rebuttal round is
only allowed if scope expanded materially or a new contract-level claim emerged
from Round 2 itself.

Capture the rebuttal outcome in the issue's `Council:` block: which claims were
contested, who refined or withdrew, and which conflicts remained unresolved
(those must either be rejected or escalated to the user, not silently accepted).

## Verification Workflow

1. Scope the change and list the relevant section files.
2. Run the full council when the change is non-trivial.
3. Classify council claims as `accept`, `adapt`, `reject`, or `conflict`.
4. If any `conflict` remains, run one rebuttal round (see
   `Round 2 — Conflict Rebuttal`) and re-classify.
5. Verify accepted and adapted claims locally with `rg`, `sed`, and direct
   section reads.
6. Check current Mastra code only when the spec depends on existing behavior.
7. Apply one orchestrator-owned patch.
8. Re-read the edited files.
9. Run a final council pass only when the diff changes behavior, storage,
   recovery, external integration, or API guarantees.
10. Report which reviewers ran, which claims were used, whether a rebuttal
    round was required, and whether any CLI was unavailable or used a different
    configured model ID. Mirror the same summary into the issue's `Council:`
    block when the change is tied to an issue transition.

## Failure Handling

- If a CLI tries to edit files, stop that run and discard the output.
- If a model cannot access the scoped files, rerun with a narrower prompt or
  pass the relevant excerpts explicitly. A zero exit code does not override
  visible file-access failures.
- Do not leave background council sessions running when finalizing a task. Wait
  for completion, retry or mark failed reviewers, and summarize the outcome.
- If reviewers disagree on a contract-level point, verify against
  `OBJECTIVES.md`, `issues/`, and the section files before editing.
- If the scope expands materially, run another full council pass.
- If the remaining work is only editorial, the orchestrator can finish without
  another council loop.
