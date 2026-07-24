# Fix Lint for PR $PR

Fix linting and formatting issues for a GitHub PR branch, then push the changes.

The $PR argument can be either:

- A PR number (e.g., `11452`)
- A full PR URL (e.g., `https://github.com/mastra-ai/mastra/pull/11452`)

## Step 1: Get PR Information

First, extract the PR number if a URL was provided and get PR details:

RUN gh pr view $PR --json headRefName,headRepository,headRepositoryOwner,number,url

Extract from the JSON response:

- `headRefName`: The branch name to checkout
- `headRepositoryOwner.login`: The fork owner (needed for pushing)
- `headRepository.name`: The repository name

## Step 2: Check for Clean Working Directory

Before switching branches, ensure there are no uncommitted changes:

RUN git status --porcelain

If there are uncommitted changes, warn the user and ask how to proceed (stash, commit, or abort).

## Step 3: Fetch and Checkout the Branch

Fetch the PR branch and check it out. Use the branch name from Step 1:

RUN git fetch origin pull/$PR/head:<branch-name-from-step-1>
RUN git checkout <branch-name-from-step-1>

If checkout fails (e.g., branch already exists), try:

RUN git checkout <branch-name-from-step-1>
RUN git pull origin <branch-name-from-step-1> --ff-only

## Step 4: Run Lint and Format Fixes

Run the formatting and linting commands to auto-fix issues:

RUN pnpm prettier:format
RUN pnpm format

## Step 5: Check for Changes

Check if any files were modified by the linting/formatting:

RUN git status

If there are no changes, inform the user that the branch is already properly formatted and linted, then skip to Step 7.

## Step 6: Commit and Push

If there are changes, commit them. Only stage the modified files (not untracked files that may be local):

RUN git add -u
RUN git commit -m "chore: fix lint and formatting issues"

Push to the contributor's fork using the owner from Step 1:

RUN git push https://github.com/<owner-from-step-1>/<repo-name>.git HEAD:<branch-name-from-step-1>

If push fails due to permissions, inform the user they may need to ask the contributor to grant push access or the contributor needs to fix lint themselves.

## Step 7: Return to Original Branch

Switch back to the main branch:

RUN git checkout main

Inform the user whether lint fixes were pushed or if the branch was already clean.
