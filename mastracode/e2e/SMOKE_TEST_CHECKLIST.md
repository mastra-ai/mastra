# Mastra Code E2E Manual Smoke Test Checklist

Use this checklist to manually verify the restored Mastra Code behavior on the `fix/mc-e2e-failures` branch. Check each item with your own eyes and mark it when you agree the behavior is correct.

## High-priority pass

- [ ] **Request access approval prompt**
  - Trigger a `request_access` flow for a path outside the project root.
  - Approve the prompt.
  - Verify the resolved inline prompt says something like `✓ Granted access to /some/path`, not just `✓ Yes`.
  - Verify the follow-up tool call can read the granted path.

- [ ] **Blocked prompt attachments restore**
  - Attach or paste an image/file.
  - Type a prompt that is blocked by a user prompt hook.
  - Verify the editor text is restored after the block.
  - Verify the pending attachment/image is still present.
  - Retry and confirm the original text + attachment sends successfully.

- [ ] **Custom provider model selector**
  - Add or import a custom provider with a model ID.
  - Open the model selector.
  - Verify the custom provider/model appears as a normal selectable catalog item.
  - Verify it does not only appear as a free-form `Use: ...` fallback.
  - Select it and confirm it persists normally.

- [ ] **Task history reload**
  - Complete a task list.
  - Exit/reopen or reload the thread.
  - Scroll to the prior task tool output.
  - Verify completed task items render inline in history.
  - Verify completed item text is green/plain, not strikethrough.
  - Verify the completed task receipt is not blank.

- [ ] **Built-in subagent delegation**
  - Ask the agent to use a subagent to inspect/search something.
  - Verify a subagent activity row appears.
  - Verify it shows the subagent task/mode.
  - Verify it completes with `✓`.
  - Verify the parent response incorporates the subagent result.

- [ ] **Execute subagent write behavior**
  - Ask for a plan subagent to inspect something.
  - Ask for an execute subagent to write or modify a small temp/test file.
  - Verify the plan subagent behaves read-only.
  - Verify the execute subagent can write/modify/run commands.
  - Verify execute does not look like it has every possible tool; it should follow the restored allowlist semantics.

- [ ] **Goal approval handoff**
  - Ask for a plan.
  - Choose the goal handoff action, such as `Set as goal`.
  - Verify the goal starts pursuing.
  - Verify the status line/goal UI reflects active goal state.
  - Verify no structured-output scorer error appears.

- [ ] **Custom goal slash autocomplete**
  - Create or use a custom slash command with `goal: true` in its frontmatter.
  - Type enough of `/goal/<command-name>` to trigger autocomplete, for example `/goal/custom-go`.
  - Press Tab to accept the autocomplete suggestion.
  - Verify the editor keeps the leading slash and shows `/goal/<command-name>`, not `goal/<command-name>`.
  - Press Enter.
  - Verify the command starts a goal using the custom command template output.
  - Verify it does not send `goal/<command-name>` as a normal user message.

- [ ] **Steered custom slash command rendering**
  - Start a slow/streaming agent response.
  - While it is still active, submit a custom slash command such as `//steer-render`.
  - Verify the command appears while pending/delivering.
  - After delivery, verify it remains visible as a slash-command component with its expanded template content and `/command-name` footer.
  - Verify it does not disappear from the chat once the agent responds to the steered command.

- [ ] **Persistent goal resume/judge decision**
  - Start a goal with a judge model.
  - Pause it.
  - Resume it.
  - Let the next turn complete.
  - Verify the resumed goal is judged after the follow-up turn.
  - Verify it can transition to done/waiting/continue.
  - Verify it does not stay stuck in `pursuing goal` forever.
  - Verify it does not fall back to the wrong judge model.

## Full manual checklist

- [ ] **Queued prompt + request access interleave**
  - Trigger a prompt that asks a question or access approval while another prompt is queued.
  - Answer/approve the first prompt.
  - Verify the suspended tool row changes from pending `⋯` to completed `✓`.
  - Verify the formatted answer/result remains visible.
  - Verify the queued prompt continues afterward without stale pending rows.

- [ ] **Notification inbox CRUD output**
  - Create/list/read/dismiss/archive notifications through the notification inbox tools.
  - Let the flow produce enough output to scroll.
  - Verify status transitions are inspectable in output history: `pending`, `seen`, `dismissed`, `archived`.
  - Verify the final response reflects the completed notification flow.

- [ ] **OM/model override reload**
  - Select a custom-provider model for an override/model pack.
  - Restart or reload Mastra Code.
  - Open the relevant model selector again.
  - Verify the selected override is restored.
  - Verify the custom model still appears in the catalog after reload.
  - Verify there is no fallback/free-form-only behavior.

- [ ] **Task inline transitions**
  - Ask the agent to create/update tasks.
  - Have it mark tasks in progress and completed.
  - Verify task rows update live.
  - Verify pending/in-progress/completed states are visible.
  - Verify completed tasks eventually show as completed/cleared without disappearing too early.

- [ ] **Task patch tools**
  - Create a task list.
  - Ask the agent to update one task.
  - Ask it to complete one task.
  - Verify the single-task patch updates the correct task.
  - Verify completion state is reflected inline.
  - Verify no stale duplicate task state remains.

- [ ] **Task prompt context next turn**
  - Create a task list.
  - Send a follow-up prompt asking the agent what it is currently working on or what tasks remain.
  - Verify the agent correctly references the current task list.
  - Verify it does not behave like it forgot the task state.

- [ ] **Workspace tool output rendering**
  - Ask the agent to run a shell command that prints a unique marker.
  - Ask it to summarize what the command output was.
  - Verify the shell/tool output marker is visible in the UI.
  - Verify the assistant's next message correctly references the marker.

- [ ] **Subagent model startup restore**
  - Configure a non-default model for a subagent mode.
  - Restart Mastra Code.
  - Trigger that subagent.
  - Verify the subagent row shows the restored model ID.
  - Verify it does not silently fall back to the default model.

- [ ] **Persistent goal commands**
  - Start a persistent goal.
  - Let the agent respond.
  - Use goal commands such as list/status/pause/resume.
  - Verify goal state updates without scorer validation errors.
  - Verify no `Structured output validation failed` error appears.

- [ ] **Slow CI-ish interaction checks**
  - Open a nested model selector.
  - Type into the nested modal slowly and quickly.
  - Run `/hooks reload` or equivalent hooks command if configured.
  - Verify the nested modal opens reliably.
  - Verify typed text appears correctly.
  - Verify hooks reload behavior is confirmed by the subsequent hooks list/config output, not only a transient toast/message.
