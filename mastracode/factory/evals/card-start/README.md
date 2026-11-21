# Card-start decision eval

Checks how a Factory session's next turn responds to an ask in a Slack thread, using the real tool descriptions from `src/`. It's a standalone script, not part of the unit suite, because it calls a live model.

Each scenario in [`scenarios.ts`](./scenarios.ts) is an invented Slack thread (no production history) with one expected outcome:

| Expectation                               | Passes when the turn                                         |
| ----------------------------------------- | ------------------------------------------------------------ |
| `start` (work asked for now)              | moves a card or starts a side session, not just files a card |
| `file-only` (asked to track for later)    | files a card and moves nothing                               |
| `side-session` (asked for a side session) | starts a side session and moves no card                      |

Tools are stubbed. A card move is accepted and the card then shows its new stage, but no session is ever shown mid-run on it. `claimsCardRunning` counts runs that moved a card and then told the person its work is running. The stubs never confirm a run, so that claim goes beyond what the result proved.

## Run

Needs `ANTHROPIC_API_KEY` (or the key for `--model`).

```sh
# working tree
pnpm --filter ./mastracode/factory exec tsx evals/card-start/run.ts --runs 5
# a base commit's work-item and session tool text, for comparison
pnpm --filter ./mastracode/factory exec tsx evals/card-start/run.ts --runs 5 --ref "$(git merge-base HEAD origin/main)"
```

Each run writes `results/<base|head>-<commit>.json` with every turn's tool calls and replies.

## Recorded results

Model: `anthropic/claude-opus-5-5`, 5 runs per scenario.

| Scenario                   | Expect       | Base `79a30b6d5c7` passed | Head `fbd882c41d8` passed | Base claims card running | Head claims card running |
| -------------------------- | ------------ | ------------------------- | ------------------------- | ------------------------ | ------------------------ |
| fix-now                    | start        | 5/5                       | 5/5                       | 2                        | 0                        |
| go-for-it-after-discussion | start        | 5/5                       | 5/5                       | 5                        | 0                        |
| just-do-it                 | start        | 5/5                       | 5/5                       | 3                        | 0                        |
| file-for-next-sprint       | file-only    | 5/5                       | 5/5                       | 0                        | 0                        |
| track-so-we-dont-forget    | file-only    | 5/5                       | 5/5                       | 0                        | 0                        |
| side-session-investigation | side-session | 5/5                       | 5/5                       | 0                        | 0                        |
| side-session-pr-fix        | side-session | 5/5                       | 5/5                       | 0                        | 0                        |

With these short synthetic threads, the base text already starts the work. The filed-and-stopped turns seen in production came from long threads with a lot of context, and these scenarios don't reproduce them. What this eval does show is that the head text keeps every decision the same, including leaving file-for-later cards unstarted and using side sessions when asked. After a move, head stops claiming the card is running: 10 of 15 base runs did, 0 of 15 head runs.
