---
'@mastra/factory': patch
---

Updated the `factory_start_session` guidance for pull request reviews in side sessions. The starting agent now decides from the person's request whether the side session may post its verdict as a GitHub review (approve or request changes), says so in the prompt, and asks the person first when that is unclear. Whenever it grants posting, it also tells the side session up front not to post the review as a plain comment: if the posting account opened the pull request or GitHub refuses the verdict, the side session reports back instead.
