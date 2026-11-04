---
'@mastra/react': patch
---

Fixed `useSpeechRecognition` dictating through the previous agent right after `agentId` changes. Until the new agent's voice is checked, dictation uses the browser's speech recognition.
