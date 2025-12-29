# Fix Lint for PR $PR

Fix linting and formatting issues for a GitHub PR branch, then push the changes.

The $PR argument can be either:

- A PR number (e.g., `11452`)
- A full PR URL (e.g., `https://github.com/mastra-ai/mastra/pull/11452`)

## Step 1: Get PR Information

First, extract the PR number if a URL was provided and get PR details:

RUN gh pr view $PR --json headRefName,headRepository,headRepositoryOwner,number,url

Note the branch name from `headRefName`.

## Step 2: Fetch and Checkout the Branch

Fetch the latest changes and checkout the PR branch:

RUN git fetch origin
RUN git checkout <branch-name>
RUN git pull origin <branch-name>

## Step 3: Run Lint and Format Fixes

Run the formatting and linting commands to auto-fix issues:

RUN pnpm prettier:format
RUN pnpm format

## Step 4: Check for Changes

Check if any files were modified by the linting/formatting:

RUN git status

If there are no changes, inform the user that the branch is already properly formatted and linted.

## Step 5: Commit and Push

If there are changes, commit and push them:

RUN git add -A
RUN git commit -m "chore: fix lint and formatting issues"
RUN git push origin <branch-name>

## Step 6: Return to Original Branch

Switch back to the main branch:

RUN git checkout main

Inform the user that the lint fixes have been pushed to the PR branch.
