---
'@mastra/react': patch
---

Fixed `recordMicrophoneToFile` labelling every recording as WebM. Safari recordings are now `audio/mp4` files named `.m4a`, and Firefox recordings `audio/ogg` files named `.ogg`; Chrome recordings stay `audio/webm`. The type never carries a `codecs` parameter. The microphone is also released when the browser can't start recording.
