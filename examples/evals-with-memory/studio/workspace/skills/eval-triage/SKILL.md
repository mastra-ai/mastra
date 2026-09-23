---
name: eval-triage
description: "How to read a failing row in a Mastra experiment and decide what to do about it. Covers the four things a low score actually means, how to tell a broken agent from a broken scorer, and when a red row is the dataset's fault. Use this skill when triaging eval results, investigating a regression, or deciding whether a score can be trusted."
license: Apache-2.0
metadata:
  author: Nimbus Support
  version: "1.0.0"
---

# Triaging a failing eval row

A low score is a question, not a verdict. Before changing the agent, work out
which of four things you are actually looking at.

## The four causes, in the order worth checking

1. **The agent is wrong.** It answered, and the answer is bad. This is the only
   case where changing the prompt or the model is the right response.
2. **The scorer is wrong.** The answer is fine and the scorer cannot see it —
   a keyword check looking for "15 GB" against an answer that says "15GB".
   Read the scorer's `reason` field before you believe its number.
3. **The dataset is wrong.** The `groundTruth` encodes an answer that is no
   longer true, or the question is ambiguous enough that two correct answers
   exist. Fixing this raises the score without touching the agent, which is
   why dataset edits must be versioned.
4. **Nothing is wrong.** The row is a deliberate failure, kept so the suite
   proves it can still detect one.

## Telling cause 1 from cause 2

Open the row and read the output next to the reason. If you would have accepted
the answer as a human, it is the scorer. A scorer that disagrees with an
obviously good answer is a bug in the scorer, and shipping around it teaches
the agent to satisfy a broken metric.

See `references/score-reasons.md` for what each reason string means.

## Before blaming the agent

Check that the comparison is honest:

- Are both runs on the same **dataset version**? A version mismatch makes the
  delta meaningless, and it is only a warning.
- Was the experiment **pinned to an agent version**? An unpinned run scores the
  prompt in the repository, which may not be the prompt that is live.
- Did a **tool** return different data between runs? Without mocks, an eval
  inherits every dependency the agent touches.

## What to do with a real regression

Fix forward, then prove it: re-run the same dataset version against the new
agent version and compare against the run that failed. A regression that was
never reproduced was never fixed.
