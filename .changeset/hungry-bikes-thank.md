---
'@mastra/factory': minor
---

Organization admins can now edit any Factory skill for one Factory from Settings › Skills, without redeploying. This covers built-in, folder, and code skills, including the review skills. Sessions that start after a save use the edited instructions; other Factories keep the original. An edited skill shows an **Edited** badge, the editor notes when the original changed since the edit, and **Revert to original** removes the edit. Other members can view skills but not change them. Saves and reverts are recorded in the audit log as `factory.skill.updated` and `factory.skill.reverted`.
