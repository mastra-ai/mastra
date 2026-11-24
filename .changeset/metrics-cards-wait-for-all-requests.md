---
'@mastra/playground-ui': patch
---

Metrics cards now wait for all their requests before reporting a failure. The "Resources and threads" and breakdown cards used to show "Couldn't load this data" as soon as one of their requests failed, even while another was still running. Retry re-sends only the requests that failed, so a request that failed later left the card stuck until a second click. Cards now report the failure once every request behind them has settled, and one Retry recovers them. A request that fails after that click is the next click's job.
