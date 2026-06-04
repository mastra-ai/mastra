---
---

Add automated release notifications for linked issues.

When a PR is merged into `main`, linked issues are labeled `pending-release` and receive a comment confirming the fix will be included in the next release. Once the alpha prerelease is published, the comment is updated to indicate availability in the alpha channel. After the stable release, the comment is updated again to reflect the latest stable release and the `pending-release` label is removed.
