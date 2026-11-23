---
'@mastra/factory': patch
---

Updated the `factory_start_session` guidance for pull request reviews in side sessions. The starting agent now decides from the person's request whether the side session may post its verdict as a GitHub review (approve or request changes), says so in the prompt, and asks the person first when that is unclear. When GitHub refuses a verdict, the starting agent tells the side session to report back instead of posting a plain comment.
