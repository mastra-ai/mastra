---
'@mastra/factory': patch
---

Fixed the Factory chat showing the same tool call twice, such as two identical plan cards with their own Approve and Reject buttons. When the server saved a run as several steps, a later step that only held tool calls appeared as a second turn the next time the page refreshed the transcript. Every saved step now attaches to the live turn it belongs to.
