---
'@mastra/memory': patch
'@mastra/core': patch
---

Fixed token estimates for long numbers. A long number used to count as one token, so output full of numbers could grow far past memory and token limits without triggering them. Long numbers are now counted accurately, and limits trigger at the right time.

Estimates saved on existing messages are recalculated, so existing conversations also get the corrected counts.
