# Unified tool UI review fixes design

## Goal

Fix the four regressions identified in pull request #21760 without changing the public tool-call API or restoring test-only markup.

## Scope

The change covers four behaviors:

- Playground end-to-end tests use the accessible tool payload structure introduced by the pull request.
- Tools that require approval or expose a suspension payload open automatically so the required action is visible.
- File-edit diffs use the existing asynchronous Shiki loader instead of adding a synchronous highlighter to the tool-call bundle.
- Tool-call rails connect only adjacent rendered tool calls.

The change does not add a new tool status, redesign the tool cards, modify examples, or change product documentation.

## Accessible test contract

`ToolCall` already exposes a group named `Tool: <toolName>`. Its payload card exposes nested groups named `Input` and `Output`. These roles and names are the browser-test contract.

The streaming end-to-end test scopes all payload queries to the `Tool: weatherInfo` group. It opens that group's disclosure button, then reads the nested `Input` and `Output` groups. The implementation does not restore the removed `tool-args` and `tool-result` test IDs.

## Pending-action disclosure policy

A tool has a pending approval when approval metadata exists and the tool has not been called. A tool also requires attention when it has a suspension payload. Any badge with either condition passes `defaultOpen` to the shared `Tool` or `ToolCall` component.

The policy is implemented by a small pure helper for approval state. Badge-specific tool completion rules remain local because generic tools, code mode, agents, workflows, file trees, and sandbox executions determine completion differently.

Uncontrolled badges use the existing `defaultOpen` synchronization in `Tool`. File-tree and sandbox badges retain controlled disclosure state because file-tree summaries depend on the collapsed state. Their state synchronizes with pending approval so approval controls cannot remain hidden. Completed tools without a pending action remain collapsed by default.

No `waiting-approval` status is added. The existing running state remains unchanged, while the expanded body makes the required action explicit.

## Asynchronous diff highlighting

The `Code` component and the file-edit diff share one package-internal highlighting hook and token-line renderer. The hook calls the existing asynchronous highlighter in `CodeEditor/highlight.ts`, retains settled prefix tokens during streaming updates, and renders plain text while highlighting loads or when a language is unknown.

The diff joins the bounded lines for each side, requests highlighting once per side, and maps the returned token lines back onto the existing added and removed rows. This preserves signs, row colors, the 200-line limit, and plain-text fallback while avoiding one tokenizer call per line.

The synchronous Shiki imports and `dangerouslySetInnerHTML` helper are removed from the tool-call path. File-extension detection remains a lightweight utility with no Shiki imports. The public `Code` and `ToolCall` exports remain unchanged.

## Tool-call rail adjacency

`MessageRow` computes a set of tool parts that are immediately followed by another tool part in the already-filtered renderable part list. A rendered text, reasoning, file, or signal part breaks the sequence. Hidden tool parts and empty text are filtered before the computation and therefore do not introduce a visual gap.

Membership checks use a `Set` rather than repeatedly searching the list while rendering.

## Test strategy

Each behavior starts with a failing regression test:

- `tool-call.test.tsx` proves diff text renders immediately and syntax tokens arrive asynchronously.
- Badge tests prove approval and suspension actions are visible without opening the disclosure manually, while completed badges remain collapsed.
- `message-row.test.tsx` proves prose and reasoning break rails, while non-rendered parts do not.
- `stream.spec.ts` uses the accessible `Input` and `Output` groups and still verifies the streamed result before and after reload.

Targeted Vitest suites run first. Package typechecks and builds follow. The final validation includes the focused Playwright streaming spec and mobile, tablet, and desktop screenshots of a tool transcript.
