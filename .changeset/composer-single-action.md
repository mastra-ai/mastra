---
'mastra': patch
'@mastra/factory': patch
---

The Studio and Factory chat composers now show one button while an agent is running: Stop until the draft has something to send, then Send. Sending or clearing the draft brings Stop back. A Factory draft with only images keeps Stop, since images can't be sent mid-run. Studio agents that can't take messages mid-run keep showing Stop.
