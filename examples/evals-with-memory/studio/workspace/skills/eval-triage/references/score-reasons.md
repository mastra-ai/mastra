# What each score and reason means

The workshop's `answer-accuracy` scorer emits one of four reasons. Each maps to
a different action.

| Score | Reason begins | What happened | Do this |
|---|---|---|---|
| `1` | "the answer stated the expected fact" | The output contained `groundTruth`. | Nothing. |
| `0.5` | "the agent declined to answer" | The output matched a refusal marker. | Decide whether the agent *should* know this. If yes, it is a knowledge gap, not a wording problem. |
| `0` | "the agent produced no output" | Empty string reached the scorer. | Almost always a plumbing bug — the scorer received `MastraDBMessage[]` and could not read text out of it. |
| `0` | "the answer never mentioned … and did not decline" | The agent answered confidently and wrong, or answered correctly in words the scorer cannot match. | Read the output. This is where scorer bugs hide. |

## Why a refusal is worth 0.5

It is a design decision, not a rounding artefact. An honest "I don't know"
costs the customer one follow-up. A confident wrong answer costs them a support
ticket and their trust in every other answer. Scoring them the same would tell
the agent they are interchangeable.

## The 0 that is really a plumbing bug

Calling a scorer directly hands it the string you passed in. `runEvals` hands
it the agent's `MastraDBMessage[]`, where `content` is an object with `parts`,
not a string. A scorer that only handles strings scores 0 on every row and
never errors — a whole suite of zeros with a healthy agent behind it.

If every row scores 0, suspect this before suspecting the agent.
