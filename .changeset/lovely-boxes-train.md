---
'@internal/playground': patch
---

Fixed missing slide-in animation on the Save as Dataset Item drawer opened from the Observability page. The drawer was being conditionally mounted only while open, which prevented Base UI's open transition from firing.
