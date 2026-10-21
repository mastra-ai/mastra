---
'mastracode': minor
'@mastra/code-sdk': patch
---

Theme selection moved into `/settings`, and a new **Terminal background** setting can paint the terminal with the theme's background color.

The **Theme** entry in `/settings` previews each theme as you move through the list. The `/theme` command is removed.

Turn on **Terminal background** to recolor terminals that support OSC 11, such as Ghostty, iTerm2, kitty, and WezTerm. It is off by default, and your own background color comes back when Mastra Code exits or is suspended.
