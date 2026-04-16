---
'mastracode': patch
---

Improved observational memory activation output in MastraCode.

**What changed**

- Added a separate Observation TTL line when buffered context activates after inactivity
- Removed repeated TTL text from each activation line so grouped activations are easier to scan

This makes long idle-thread activations much easier to read in the terminal.
