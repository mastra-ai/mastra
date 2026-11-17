---
'@mastra/factory': patch
---

Reduced the work the Factory server does to keep the session sidebar and board up to date, and fixed session latency timestamps on LibSQL.

- Projects without a linked repository no longer rebuild their session list on every sidebar poll.
- Session activity now sorts only the cards that are running, waiting or held by a session, instead of every card on the board.
- A session's first materialize, first message and first command times are now recorded once when several Factory processes share one LibSQL database, so the earliest time is kept.
