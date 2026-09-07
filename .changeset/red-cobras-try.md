---
'@mastra/factory': patch
---

Fixed Slack emoji showing as raw shortcodes in the Factory feed. An aside like `aside: nice :thumbsup:` lands on the card as "nice 👍" instead of "nice :thumbsup:", and a thread's card title reads the same way.

Custom workspace emoji are images with no unicode character, so a name like `:party-parrot:` keeps its colons. Substitution happens as messages arrive: comments and titles stored before this release keep the shortcodes they were saved with.
