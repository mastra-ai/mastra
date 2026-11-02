---
'@mastra/code-sdk': patch
'mastracode': patch
---

When a model refuses a request on safety grounds, Mastra Code now moves the request to the next model in the pack's fallback chain instead of ending the turn. A cybersecurity refusal still gets one `continue` nudge on the same model first. The transcript shows "Switched model pack: … (model refused)". Packs without a fallback behave as before.
