---
'@mastra/code-sdk': patch
---

Fixed the cross-agent signal sender telling the model to resend a signal that failed direct delivery. The signal waits in the recipient's inbox and is retried automatically, so the sender now tells the model not to resend it. A resend while that signal is still pending merges into it; a resend after it is delivered sends the recipient a second copy.
