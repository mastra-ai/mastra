---
'@mastra/factory': patch
---

Fixed Factory reviews posting a verdict that contradicts their review text.

- The source-control review tool, which GitLab reviews use, now rejects a review whose `Verdict:` line does not match the approve or request-changes choice. It also rejects a review whose `Reviewed head:` is not the current merge request head.
- GitHub review skills now write each review body to a file named after the reviewed commit. Before posting, they check the verdict line and reviewed head, and they delete the file afterwards. A review written for an earlier commit is no longer reposted on a newer one.
