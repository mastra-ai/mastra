---
'@mastra/auth-firebase': patch
---

Updated `firebase-admin` to v14 and switched to its modular API (`firebase-admin/app`, `firebase-admin/auth`). v14 drops `node-forge`, which has an unfixed signature-forgery advisory (CVE-2026-85393). No change to how you configure `MastraAuthFirebase`.
