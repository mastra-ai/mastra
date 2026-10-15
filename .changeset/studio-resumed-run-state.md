---
'@mastra/playground-ui': patch
---

Fixed Studio showing a resumed workflow run as Suspended. This happened when the run was resumed from code or the API, such as `run.resume()`. Studio asked for approval again. Studio now shows the run as running, with the approved step marked complete.
