---
'@mastra/core': patch
---

Fixed ModelRouter-resolved AI SDK v6 providers dropping multimodal tool results. When a tool returned an image or file as a media content part, the router path previously forwarded the legacy `media` shape instead of converting it to `image-data`/`file-data`, so providers could drop or reject those parts. (#21183)
