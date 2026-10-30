---
'@mastra/playground-ui': patch
---

Metrics cards no longer report a loading failure while another of their requests is still in flight. Previously the "Resources and threads" and breakdown cards could show "Couldn't load this data" as soon as one request failed, even though a second request was still running; Retry then re-sent only the failed request, so the card could not recover until that second request failed too. The cards now report the failure once all their requests have settled, and Retry recovers them on the first click.
