---
'@mastra/core': patch
---

Fixed `mastra_workspace_read_file` never returning media parts with strict-schema providers. The media branch was gated on the optional `encoding` argument being absent, but strict-schema providers (e.g. OpenAI, Vercel AI Gateway) always populate optional parameters, making the branch unreachable and turning `mediaTypes`/`maxMediaBytes` into dead config. Media surfacing is now decided from the file's mime type and tool config rather than the absence of `encoding`, so configured media (e.g. PNG/JPEG/PDF within `maxMediaBytes`) is returned as a native file/image part regardless of the model-supplied `encoding`. An explicit `encoding` still reads raw bytes for non-configured binary types and for oversized media.
