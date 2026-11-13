---
'@mastra/factory': minor
---

Platform integrations (Jira, incident.io, GitLab, Vanta) now use the connections linked to the Factory's Mastra platform project, so platform events for those connections reach the Factory.

- At startup, the Factory links the organization's existing Jira, incident.io, GitLab and Vanta connections to its project, so nothing you already connected disappears. New connections made from the Factory are linked to the project when they're created.
- If a connection can't be linked, the integration's status lists it under `needsLinking` with the reason. Org admins can retry with `POST /web/integrations/platform/:provider/link-connections`. A permission refusal means the Factory's platform credential needs `integrations:write`.
- A session keeps its other tools when one integration can't load its own, instead of losing them all.
