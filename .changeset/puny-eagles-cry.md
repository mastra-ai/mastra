---
'@mastra/react': patch
---

Fixed `recordMicrophoneToFile` labelling every recording as WebM: the file now uses the recorder's real type and extension, such as `.m4a` in Safari. The microphone is also released when the browser can't start recording.
