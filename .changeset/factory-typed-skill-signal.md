---
'@mastra/factory': patch
---

Traces and memory now show the skill that started a Factory run, instead of recording the kickoff as a message a person typed. The model still receives the skill instructions inside `<skill name="…">`, but `&`, `<` and `>` in the instructions and work-item feed now arrive XML-escaped (for example, `2>&1` becomes `2&gt;&amp;1`).

Skills you start from the chat are unchanged and still appear as your own message.
