---
'@mastra/factory': patch
---

Fixed GitHub and GitLab pull request events being dropped when the subscribed session was open on a different thread. Delivery now switches the session onto the pull request's thread as the subscribing user, so CI results, reviews and merges reach the session instead of failing with "the request has no authenticated user".
