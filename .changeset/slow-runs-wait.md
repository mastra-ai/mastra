---
'@mastra/factory': patch
---

Fixed the Factory dispatcher starting a duplicate run while a skill run longer than ten minutes was still working. A run the run registry still shows in flight is left alone. A run older than six hours is failed as overdue, so a hung run no longer holds its slot forever.
