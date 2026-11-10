---
'@mastra/factory': patch
---

Improved how fast a teammate's session opens in Factory.

Improved Factory response times while its database can't start: requests no longer wait on a startup retry, and provider settings come back about a second after the database does instead of up to 15 seconds later.
