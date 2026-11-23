---
'mastracode': minor
'@mastra/factory': patch
'@mastra/code-sdk': patch
---

Local embeddings for memory recall are now installed the first time recall needs them, instead of with `mastracode`. This removes `@mastra/fastembed` and ONNX Runtime from a fresh install. The first embedding shows "Installing local embeddings for memory recall…" and takes a few seconds; later sessions reuse it.

**New command:** `mastracode features` lists optional features and where they are installed. Run `mastracode features install --all` to install them ahead of time, for example in a Docker image or before going offline.

If the install cannot run (offline, registry refused, or `MASTRACODE_FEATURE_INSTALL=never`), Mastra Code says why and how to fix it instead of failing silently.
