---
'@mastra/factory': minor
---

The Factory now re-reviews a pull request when review is re-requested from its GitHub bot. After any Factory verdict (approve or request changes), clicking GitHub's re-request review button on the Factory reviewer moves the Review card back into Reviewing and starts a fresh review pass. Only trusted collaborators (write or admin) can trigger it, and re-requests aimed at human reviewers or on closed, merged, or already-in-review pull requests are ignored.
