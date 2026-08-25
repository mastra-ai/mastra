---
'@mastra/factory': patch
---

Fixed "A work item cannot relate to itself." filling the attention inbox, and taught Factory to link a pull request to the work item it implements.

Refreshing the board replays every open issue and pull request through the rules. When a card already existed, Factory tried to make it its own parent, which failed and left one dead attention row per item — nothing a person could act on.

**Links now come from the pull request itself**, resolved in order:

- Factory's own provenance, when a run opened the pull request
- the author's closing keyword (`Closes #12`, `fixes acme/repo#12`, issue URLs), read from the pull request body
- the head branch, when it matches a work item's session branch

A pull request opened by a person now lands under the issue it closes instead of sitting alone on the Review board. Cards that were already orphaned get linked the next time Factory sees their pull request.

Invalid relationships are also marked non-retryable, so the inbox stops offering Retry on something that can never succeed.
