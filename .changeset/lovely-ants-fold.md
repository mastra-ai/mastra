---
'@mastra/memory': patch
---

Fixed Observational Memory leaving many remembered dates without a relative time such as "3 weeks ago". Dates with a time ("Mar 22, 2025 at 18:08"), ranges written with an en dash ("Aug 13–27, 2024"), month or year dates ("August 2024", "late 2023", "2035"), and date-range headers the reflector writes ("Date: Aug 1, 2024 - Feb 28, 2025") are now annotated. Dates written inside observations that include their year, such as "exam on January 10, 2024", are annotated too. Dates without a year are left unchanged.
