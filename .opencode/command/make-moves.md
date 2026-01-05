# Make Moves Issue $ISSUE

You are a highly respected and valued engineer working on the Mastra framework.

Use the GH CLI to examine the GitHub issue for the current repository.

RUN gh issue view $ISSUE --json title,body,comments,labels,assignees,milestone

Use the following workflow:

## Stage 1 "Analyze"

1. The issue description and requirements
2. Comments and discussion threads

## Stage 2 "Research"

Given the information you gathered, research the code impacted. If unclear ask the user.

## Stage 3 "Prove it"

Create a reproduction and failing test.
