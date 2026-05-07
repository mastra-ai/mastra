---
name: pr-triage
description: Find Mastra PRs related to my expertise, sort them by merge/close potential, and pair-review them one at a time
goal: true
---
Mastra has many open PRs. We want to merge or close as many as possible, but only focus on PRs that are related to my areas of expertise.

Do this:

1. Look through git history in this repo and build a concise understanding of the areas I have worked on and am likely qualified to review.
2. Look through every open PR before stopping. Do not begin pair review until all open PRs have been inspected and categorized.
3. Create a markdown tracking file listing every open PR by relevance:
   - Definitely related to my expertise
   - Maybe related / needs my judgment
   - Probably not related
4. In the tracking file, clearly mark PRs where I am explicitly tagged as a reviewer because those are higher-priority review candidates.
5. Within each section, sort PRs in this order:
   - PRs where I am explicitly tagged as a reviewer
   - PRs with no reviewers tagged
   - PRs where reviewers are tagged, but I am not one of them
   Within each reviewer bucket, sort so easy merges or easy closes appear first.
6. After the full tracking file is ready, present the best first candidates and pair-review them with me one at a time, updating the list as we go through to add status/notes, until the list is empty.
7. For each PR in the pair-review sequence, start with a concise TL;DR that explains the issue/change, whether it needs more work or looks close to done, and any other short helpful context for deciding what to do next.
8. When pair-reviewing the first PR, ask whether I want you to open each PR in my browser with the GitHub CLI (`gh pr view <number> --web`). Ask this preference only once, then respect the answer for each PR in the pair-review sequence.

If I provide extra guidance, use it as additional selection criteria:

$ARGUMENTS
