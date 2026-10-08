---
'@mastra/memory': patch
---

Reflections now keep more of the details users ask about later. The default Reflector instructions tell it to keep every concrete fact (names, places, dates, numbers, amounts, versions, and who said what). They also tell it to keep both the old and new value, with dates, when the user changes their mind, and to keep what the user explicitly said they have never done, do not know, or refused. Reflections favor short factual lines over general summaries, and older observations are condensed in wording rather than stripped of their facts. Custom `reflection.instruction` text is still appended as before.
