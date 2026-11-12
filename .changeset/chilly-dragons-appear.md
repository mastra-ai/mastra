---
'@mastra/factory': minor
'mastra': patch
---

A board phase now does exactly what its stored fields say, so an admin who edits a phase changes what actually runs. Entering a working phase starts its `runner.skill` in the `runner.context` session, with its `instructions`, for every card source. Code handlers no longer start work in the background.

**Work runs on stored runners.** Triage runs `factory-triage`, Planning `factory-plan`, Building the new `factory-build`, Review `factory-self-review` and PR review `factory-review`. You can edit each one in Settings › Boards or through the boards API. Agents now read the card's details (sources, labels, author trust, plan approval, self-review rounds and verdicts, the pull request under review) from a new `<factory-work-item>` signal instead of their kickoff message.

**Building works as a goal.** A runner can set `goal: { objective, maxRuns }`. The run then keeps going until a judge decides the objective is met or needs a person. Building pursues the approved plan this way, with up to 20 runs. Factory marks the goal done when the card leaves the phase.

**New phase fields:**

- `tools`: the Factory tools a phase gives the session working in it (`factory_record_review_verdict`, `factory_review_source`). Tools follow the card's phase, not the session's role.
- The `item.pullRequest` rule fact. Work's Review starts on its own only while the card has no open pull request.

```ts
{
  key: 'execute',
  name: 'Building',
  kind: 'working',
  runner: {
    skill: 'factory-build',
    context: 'work',
    goal: { objective: 'Done when every step of the approved plan is implemented, tested and pushed.', maxRuns: 20 },
  },
  nextPhases: ['review', 'pr-review', 'planning', 'done', 'canceled'],
}
```

**An exit tool holds the card until it succeeds.** A working phase with an `exitTool` keeps the card until that tool succeeds in the session working the card there (for `submit_plan`, with an approved plan). Until then an agent's or rule's move on to another working phase is refused. `autoApprove` and `autoApproveWhen` only decide whether the tool approves itself or waits for a person; they no longer let an agent skip the tool. The tool's success never moves the card by itself: the agent moves it with `factory_transition_work_item`, as `factory-plan` now does after an approved plan.

**Self-review off (the default) goes straight to PR review.** The builder opens the change request and moves the card to PR review. With self-review on, an approving self-review opens the change request and moves the card to PR review.

**Existing projects are updated once, keeping your edits.** On its first load after the upgrade, each project's stored Work board gets the new runner, tools and auto-start fields. Factory fills only fields that still hold the old default. A runner's skill and goal are filled when unset, so instructions you wrote stay. One exception: if you narrowed Building's allowed moves, Building gets its skill but no goal, because the goal's hand-off may name a phase it can no longer reach. Add a goal in Settings › Boards if you want one. Anything else you edited stays as it is. App boards under the `work` key are never touched. Factory logs the fields it filled.

**After upgrading, check Review's automatic start.** A stored `autoStart: false` reads the same as unset, so the migration turns Review's on. If you had turned it off, turn it off again.

**Done no longer cleans up issue labels on its own.** Entering Done used to remove the `status:` triage labels from a GitHub issue, add `status: pending-close` and post a done comment, whoever moved the card. Now the agent that finishes the work does that before it moves the card to Done. An issue card a merge or a person moves to Done keeps its labels and gets no comment.

**Runner fields are no longer locked.** On Work and app boards, `422 code_behaviour` now covers only the phases, kinds and moves Factory's code relies on. The boards API's `codeBehaviour` reports only `requiredNextPhases` per phase.

**Deprecated and ignored:** `onEnter`, `onExit` and `outcomes` on `defineBoard()` phases. Boards that declare them still compile and log a warning once, but no handler runs. Outcome targets stay allowed moves. Move a handler's work into `runner.skill`.
