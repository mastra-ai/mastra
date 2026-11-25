---
'@mastra/factory': patch
---

Fixed new sessions starting their own environment build every time a repository changed. A new session now starts from the environment the Factory last built, and still checks out the newest commit. Starting a session asks for a rebuild only when a repository changed since that build, at most once per the push debounce window, so the environment keeps up without sessions building on their own.
