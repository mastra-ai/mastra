---
'@mastra/factory': patch
---

Factory web no longer opens the onboarding wizard when the factory list fails to load. A failed request for the list used to look like "no factories yet", so members who already had a Factory were asked to set one up again. The page now shows a retry screen until the list loads.
