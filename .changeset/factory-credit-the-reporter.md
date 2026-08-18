---
'@mastra/factory': patch
---

Credit the reporter as a co-author on work their issue caused

When Factory builds a fix for a GitHub issue, the build prompt now asks for a
`Co-Authored-By` trailer naming the person who reported it, so the reporter shows
up as a contributor on the pull request rather than only in the issue thread.

Only GitHub issues qualify. A Linear card stamps a display name and a manual card
stamps nothing, and neither resolves to the GitHub account a trailer needs, so
those are left uncredited rather than credited to nobody. Issues Factory filed
itself are skipped.

Intake already stamped the reporter's login but the stage rules could not see it;
the intake-stamped metadata now reaches rules that run on a stage.
