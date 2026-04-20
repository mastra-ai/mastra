---
'mastracode': patch
---

Fixed the observational memory reflection activation label in MastraCode so it describes the actual change to the observation pool.

Reflection activations now render as `before → after obs tokens (-delta)` instead of implying that message tokens were removed. Observation activations still use the existing `-X msg tokens, +Y obs tokens` format.
