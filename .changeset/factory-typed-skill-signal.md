---
'@mastra/factory': patch
---

Traces and memory now show the skill that started a Factory run, instead of recording the kickoff as a message a person typed. The model receives the skill instructions and work-item feed inside `<skill name="…">` as written, the same as running the skill with `/skill`.

Skills you start from the chat are unchanged and still appear as your own message.
