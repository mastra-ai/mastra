---
mode: agent
description: Handle PR review comments on the current branch's pull request
---

# Handle PR Review Comments

Use gh cli to view PR review comments for the active branch.

RUN GH_PAGER=cat gh pr view --comments

Make sure you get all comments for the PR, not just top level review comments.

For any comments from greptile: if they make sense implement them, if they don't or you want clarification, feel free to use gh cli to respond to the greptile comment thread, tag "@greptileai" in your response so the greptile bot knows to respond. If you don't agree with greptile, please make sure you add a comment and tag them so they know what/why is happening. Tag "@greptileai", not "@greptile-apps", and please don't leave a new PR review, find the exact comment and reply to the comment directly.

Anytime you make a comment, be sure to start it with "OpenCode says: " and sign off with your name at the end as well (don't use dash OpenCode, GH treats that as a bullet point list).

For any other comments: if they make sense implement them, if they don't or you want clarification, do the same as with greptile, however - first ask the user if it's ok to respond or if the user wants to do it.

For the fixes you want to make in response to comments, make sure you make a todolist first and ask the user if the list looks good before proceeding!
Make a commit for each fix/comment, and in the commit message (if you can) add the PR comment link.
Once you've made all your commits, push the branch up!
