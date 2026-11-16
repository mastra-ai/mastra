---
'@mastra/mongodb': patch
---

Fixed startup cleanup leaving an extra observational memory record live. When a store started while another process was rolling a thread's memory over to a new generation, an older record from an earlier adapter version could stay live next to the new one. Startup now counts the record being rolled over, so the older record is retired as intended.
