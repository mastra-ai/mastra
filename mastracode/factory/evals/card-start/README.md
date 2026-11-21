# Card-start decision eval

Checks how a Factory session's next turn responds to an ask in a Slack thread. It's built on Mastra datasets and experiments and runs as a standalone script, not part of the unit suite, because it calls a live model.

- **Dataset:** each scenario in [`scenarios.ts`](./scenarios.ts) is an invented Slack thread with no production history. It becomes `--runs` dataset items. Every item mocks every tool (`matchArgs: 'ignore'`) and sets `unmockedToolPolicy: 'deny'`, so the model sees the real tool descriptions but no tool executes.
- **Variants:** two agents share the system prompt (the Mastra Code build prompt plus the Slack channel text). They differ only in the work-item and session tool text. `card-start-base` loads it from `--ref` (default `git merge-base HEAD origin/main`) and `card-start-head` from the working tree. Each runs as one experiment over the same dataset.
- **Scorers:** code scorers built with `createScorer`, with no model judge:
  - `card-start-decision`: `start` asks must move a card or start a side session; `file-only` asks must file a card and move nothing; `side-session` asks must start a side session and move no card.
  - `card-start-confirmed-claims`: after a card move, the reply must not say its work is running. The mocks accept the move but never show a session mid-run, so that claim goes beyond what the results confirm. It returns `notScorable` when no card was moved.
- **Comparison:** `compareExperiments` gives per-scorer deltas and regression flags.

## Run

Needs `ANTHROPIC_API_KEY` (or the key for `--model`).

```sh
pnpm --filter ./mastracode/factory exec tsx evals/card-start/run.ts --runs 5 [--ref <git-ref>] [--model anthropic/claude-opus-5-5]
```

Writes `results/<base>..<head>.json` with the per-scenario table, the comparison and every item's tool calls, replies and scores.

## Recorded results

`anthropic/claude-opus-5-5`, 5 runs per scenario, base `79a30b6d5c7` vs head `cd3d6c1553b`:

| Scenario                   | Expect       | Decision, base | Decision, head | Confirmed claims, base | Confirmed claims, head |
| -------------------------- | ------------ | -------------- | -------------- | ---------------------- | ---------------------- |
| fix-now                    | start        | 5/5            | 5/5            | 3/5                    | 5/5                    |
| go-for-it-after-discussion | start        | 5/5            | 5/5            | 4/5                    | 5/5                    |
| just-do-it                 | start        | 5/5            | 5/5            | 4/5                    | 5/5                    |
| file-for-next-sprint       | file-only    | 5/5            | 5/5            | n/a                    | n/a                    |
| track-so-we-dont-forget    | file-only    | 5/5            | 5/5            | n/a                    | n/a                    |
| side-session-investigation | side-session | 5/5            | 5/5            | n/a                    | n/a                    |
| side-session-pr-fix        | side-session | 5/5            | 5/5            | n/a                    | n/a                    |

`compareExperiments`: `card-start-decision` 1.00 → 1.00, `card-start-confirmed-claims` 0.73 → 1.00, no regression. No item errored or failed a tool mock.

With these short synthetic threads, the base text already starts the work. The filed-and-stopped turns seen in production came from long threads with a lot of context, and these scenarios don't reproduce them. The eval does show that the head text keeps every decision the same, including leaving file-for-later cards unstarted and using side sessions when asked. It also shows head stops claiming a card is running when nothing confirms it.
