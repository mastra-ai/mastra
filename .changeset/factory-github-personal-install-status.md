---
'@mastra/factory': patch
---

GitHub status (`/web/github/status`) now returns `reason: 'personal_install_hidden'` when Mastra Platform withholds a GitHub App installed on a personal account from an organization with more than one member, instead of `not_connected`. Any other usable installation still reports `ready`.
