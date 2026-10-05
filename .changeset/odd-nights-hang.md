---
'mastracode': minor
---

Refreshed the Mastra Code terminal UI.

- **Header:** the Mastra logo in Braille next to the project info, replacing the block-letter banner.
- **Prompt and messages:** a borderless shaded prompt with a → marker; sent messages use the same panel.
- **Status line:** one row (mode · model · context · location) that stays put while the agent works. A Working row above the prompt shows the spinner, elapsed time and throughput.
- **Tool calls:** a ● status row with the output on a shaded panel. Long shell output is capped to 8 lines with a ctrl+e hint.
- **Prompts:** questions, plan approval and tool approval appear inline in the chat as cards. Tool approval is now one row under the tool call instead of a pop-up, and answered questions collapse to two lines.
- **Setup:** /setup and first-run onboarding fill the terminal with the logo and a step indicator.
- **Colors:** a lighter mint accent on dark backgrounds, softer text for tool output and the status line, and panels shaded from your terminal's own background.
