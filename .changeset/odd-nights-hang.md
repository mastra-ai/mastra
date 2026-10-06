---
'mastracode': minor
---

Refreshed the Mastra Code terminal UI.

- **Header:** the Mastra logo in Braille next to the project info, replacing the block-letter banner.
- **Prompt and messages:** a borderless shaded prompt that fades into the terminal background, with a steady → marker. Sent messages sit on a panel sized to their text, and the prompt no longer jumps when a run starts or ends.
- **Status line:** one row (mode · model · context · location) that stays put while the agent works. Long paths shorten like zsh (`~/…/parent/dir`); on narrow terminals the location moves to a second row. A Working row above the prompt shows a pulsing dot, elapsed time and throughput, and reads "thinking" while the model reasons.
- **Tool calls:** a small • status row; when a call has output, the row and its output sit on a two-tone grey card. Long shell output is capped to 8 lines with a ctrl+e hint. Subagents, `!` shell commands and observational memory use the same blocks. Skill and command messages show a collapsed `skill /name` or `command /name` header (ctrl+e expands them), and quiet-mode shell groups keep their bordered box. Notifications render in soft grey; errors, notifications, goal checks and system reminders are left-bar cards.
- **Prompts:** questions, plan approval and tool approval appear inline in the chat as cards. Tool approval is now one row under the tool call instead of a pop-up, and answered questions collapse to two lines.
- **Setup:** /setup and first-run onboarding fill the terminal with the logo and a step indicator.
- **Colors:** a lighter mint accent on dark backgrounds, softer text for tool output and the status line, and panels shaded from your terminal's own background, keeping its tint (Solarized, Gruvbox and the like) and staying visible on pure-black backgrounds. Light terminals get one consistent green and readable code colors, and 256-color terminals get neutral grey panels.
- **Fixes:** file previews no longer drop a leading number from lines like `1. Step`, and a failed shell command's dot turns red.
