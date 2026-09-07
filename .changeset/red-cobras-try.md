---
'@mastra/factory': patch
---

Slack emoji now render in the Factory feed. An aside like `aside: nice :thumbsup:` lands on the card as "nice 👍" instead of the raw shortcode, and a thread's card title reads the same way. Custom workspace emoji have no unicode character, so a name like `:party-parrot:` keeps its colons.
