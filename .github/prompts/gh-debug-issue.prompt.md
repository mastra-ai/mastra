---
mode: agent
description: Debug a GitHub issue
---

# Debug GitHub Issue ${input:issue}

Use the GH CLI to examine the GitHub issue for the current repository.

RUN GH_PAGER=cat gh issue view ${input:issue} --json title,body,comments,labels,assignees,milestone

Debugging Github issues has 3 stages. Each stage must be fully completed before moving on to the next.

## Stage 1 "Analyze"

1. The issue description and requirements
2. Any linked PRs or related issues
3. Comments and discussion threads
4. Labels and metadata

## Stage 2 "Reproduce"

Once you've analyzed the issue:

1. Create an ISSUE_SUMMARY.md file in the project root and add a summary of what you've analyzed so far. Do not begin to fix the issue, that isn't our goal.
2. Deeply explore and think about the issue. Find relevant tests and files, and docs/info about how the feature works and how it should work. Add this info to the issue summary file. Especially add info about what you think is happening and how the issue can be reproduced in a test.
3. Ask the user for feedback on your issue summary document. Do you have any misconceptions? Is your theory plausible? Did you miss anything?
4. Now that the user agrees with your findings, write a test (in the appropriate package and test file) that reproduces the issue. The test MUST fail and clearly show the problem.
5. Explain your failing test to the user. They must understand fully, and agree that the test really does reproduce the issue at hand.

## Stage 3 "Fix it!"

Now that we have a failing test, a summary of our findings, and you and the user are on the same page:

1. Commit the failing test to the current branch (don't commit the summary file)
2. Come up with a plan to fix the issue. Make sure the user agrees and is on the same page as you.
3. Write code to fix the issue. Run the failing test while you make changes and debug the issue so you know when it's fixed.
4. If you get stuck, ask the user for help! They might know something you don't, or they might have an idea you didn't have.
5. Once it's fixed, explain your fix to the user. They must agree that it's the correct fix for the issue at hand.

You MUST first reproduce the issue in a test file, make sure the new test is failing (IMPORTANT!) then finally add a code fix.
If we don't first reproduce in a unit or integration test then we can't be sure we fixed the problem.
