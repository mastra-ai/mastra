---
'@mastra/core': patch
---

Fixed workflow experiments skipping a suspended branch with resume data when an earlier suspended branch has none. The dataset experiment auto-resume loop now scans all suspended branches and resumes the first one with matching `resumeSteps`/`resumeData`, instead of stopping at the first suspended branch.
