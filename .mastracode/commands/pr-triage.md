---
name: pr-triage
description: Find Mastra PRs involving me first, sort them by merge/close potential, and pair-review them one at a time
goal: true
---

Mastra has many open PRs. We want to merge or close as many as possible, starting with PRs where I am already involved, then falling back to PRs related to my areas of expertise.

Do this:

1. Build the primary candidate queue from open PRs involving me, oldest-updated first. Use GitHub search semantics equivalent to:
   - Browser URL: `https://github.com/mastra-ai/mastra/pulls?q=is%3Aopen+is%3Apr+involves%3A%40me+sort%3Aupdated-asc`
   - Preferred CLI: `gh search prs --repo mastra-ai/mastra --state open --involves @me --sort updated --order asc --limit 100 --json number,title,author,url,updatedAt,isDraft,labels`
   - Repo-local alternative: `gh pr list --state open --search 'involves:@me sort:updated-asc' --limit 100 --json number,title,author,url,updatedAt,isDraft,labels,reviewDecision,mergeStateStatus,statusCheckRollup`
2. If the involving-me queue is exhausted or clearly too small, look through git history in this repo and build a concise understanding of the areas I have worked on and am likely qualified to review.
3. Then inspect the remaining open PRs by expertise relevance before stopping. Do not begin pair review on fallback PRs until open PRs have been inspected and categorized.
4. Create or update a markdown tracking file listing PRs by priority:
   - Involves me — primary queue, sorted oldest-updated first unless I provide a different priority
   - Definitely related to my expertise
   - Maybe related / needs my judgment
   - Probably not related
5. In the tracking file, clearly mark why each PR involves me when available: author, assignee, reviewer/review-requested, commenter, mentioned, or existing review.
6. Within the fallback expertise sections, sort PRs in this order:
   - PRs where I am explicitly tagged as a reviewer
   - PRs with no reviewers tagged
   - PRs where reviewers are tagged, but I am not one of them
     Within each reviewer bucket, sort so easy merges or easy closes appear first.
7. Present the best first candidates and pair-review them with me one at a time, updating the list as we go through to add status/notes, until the list is empty.
8. For each PR in the pair-review sequence, start with a concise TL;DR that explains the issue/change, whether it needs more work or looks close to done, and any other short helpful context for deciding what to do next.
9. After the TL;DR for each PR, stop and ask me what action to take. Do not submit a review, request changes, approve, merge, close, comment, or mark a GitHub action as taken until I explicitly choose that action.
10. When pair-reviewing the first PR, ask whether I want you to open each PR in my browser with the GitHub CLI (`gh pr view <number> --web`). Ask this preference only once, then respect the answer for each PR in the pair-review sequence.
11. If I give standing guidance during triage, apply it to later PRs. Current defaults from prior triage: open PRs in browser when reviewing, skip workflow PRs unless I override, skip PRs already approved, and skip PRs where Tyler or someone else already requested changes unless I explicitly ask to revisit.

If I provide extra guidance, use it as additional selection criteria:

$ARGUMENTS
