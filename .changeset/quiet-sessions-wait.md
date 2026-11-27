---
'@mastra/factory': patch
---

Fixed new sessions starting their own environment build every time a repository changed. A new session now starts from the environment the Factory last built, and still checks out the newest commit. A session that creates a new sandbox asks for a rebuild only when a repository changed since that build, at most once per build debounce window, so the environment keeps up without sessions building on their own. The settings page now calls this setting "Build debounce" and shows it even when rebuilding on push is off.

The default debounce window for new Factories is now 30 minutes, up from 10, so a rebuild is less likely to start while the previous one is still running. Existing Factories keep their setting.

Repositories in GitLab subgroups (`group/subgroup/repo`) now match their built environment by their full path.
