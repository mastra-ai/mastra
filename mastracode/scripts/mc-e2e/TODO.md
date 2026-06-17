# Skipped E2E Scenarios

These scenarios are temporarily skipped on the rebased `tests-mc-rebased-candidate` branch because current `main` behavior drifted from the original scenario expectations. Each skip should be revisited and either fixed in product code or updated only if the new behavior is intentional.

| Scenario | Recap | Why it seems to be failing |
|---|---|---|
| `custom-provider-model-selector` | Verifies settings-backed custom provider models appear/select correctly in the model selector. | Current `main` no longer exposes custom provider catalog entries from settings in the selector, so only free-form `Use:` behavior appears. |
| `file-attachment-blocked-retry` | Verifies an attachment submit blocked by a hook can be retried with the editor state restored. | Current `main` no longer restores the prompt + attachment placeholder after `UserPromptSubmit` blocks, so the retry path loses expected editor state. |
| `notification-inbox-crud-flow` | Exercises notification inbox list/read/dismiss/archive/search through real tools and asserts rendered statuses. | The CRUD actions complete, but current `main` collapses or removes intermediate tool output before all status lines remain visible. |
| `om-model-override-reload` | Verifies OM model override settings reload and use a seeded custom provider override. | Current `main` opens an API-key prompt while selecting the custom-provider OM model instead of resolving the seeded key/settings path. |
| `persistent-goal-commands` | Exercises persistent goal commands and verifies the goal judge path completes. | Current `main` hits a structured-output/scorer validation failure in the stubbed goal judge flow. |
| `persistent-goal-judge-decision` | Restores a persisted paused goal and drives judge `continue`/`done` decisions. | Current `main` emits changed judge decision text/flow and does not complete the original fixture path. |
| `prompt-context-instructions` | Verifies fixture project `AGENTS.md` instructions are included in the model request prompt context. | Current `main` appears to resolve project context differently, so the fixture `AGENTS.md` content is missing from the request. |
| `prompt-queue-interleave` | Exercises concurrent `ask_user` and `request_access` prompts and their sequential UI handling. | The flow completes, but current `main` no longer renders the expected `Access granted` confirmation after approval. |
| `request-access-modal` | Verifies approving `request_access` allows reading an external path in the same turn. | The read succeeds, but current `main` no longer renders the expected `Access granted` confirmation line. |
| `skills-command-activation` | Verifies `/skills` activation behavior around a goal/skill flow. | Current `main` hits the same goal judge structured-output/scorer validation failure after skill activation. |
| `subagent-delegation` | Verifies Explore subagent delegation renders progress rows and returns the expected result. | Current `main` changes subagent progress rendering/request count, so the original UI and AIMock expectations no longer match. |
| `subagent-plan-execute-tools` | Verifies Plan and Execute subagents run and the execute subagent writes an expected workspace file. | Current `main`'s execute subagent path does not write the expected output file, indicating a subagent workspace tool regression. |
| `subagent-model-startup-restore` | Verifies persisted subagent model defaults are restored and used for delegated subagents. | Current `main` changes the subagent delegation rendering/result path, so the restored-model flow no longer reaches expected assertions. |
| `task-inline-transitions` | Verifies task tool inline UI transitions from pending/in-progress to completed/cleared. | Current `main` changes task-state/tool-result request shape enough that the AIMock fixture no longer matches mid-flow. |
| `task-patch-tools` | Exercises task write/update/check tools and verifies task-check rendering. | Current `main` changes task-state/tool-result request shape, so the task patch AIMock fixture stops matching. |
| `task-prompt-context-next-turn` | Verifies current task list is injected into the next model request prompt context. | Current `main` changes task-state request shape, preventing the prompt-context fixture from matching. |
| `tool-history-reload` | Restores a seeded thread with completed tool calls and verifies loaded tool history rendering. | Current `main` still renders seeded view/web history, but no longer renders the seeded task history entries. |
| `workspace-tool-output-rendering` | Verifies shell and LSP workspace tool outputs render and the assistant completes. | Current `main` repeats workspace tool calls and never reaches the final assistant completion text. |
