# Documentation styleguide

Use this file as the default writing guide for Mastra's documentation.

## Core rules

- Write clearly and directly.
- Prefer short sentences, short paragraphs, simple words, and low jargon.
- Break up dense text with headings and bullet lists.
- Write docs for readers who may be tired, rushed, reading in a non-native language, or new to the ecosystem.
- You can check prose in [Hemingway App](https://hemingwayapp.com/).
- Also see Google's guides for [inclusive documentation](https://developers.google.com/style/inclusive-documentation) and [accessible documentation](https://developers.google.com/style/accessibility).

## Keep docs current

- Use current model names for providers such as OpenAI and Claude.
- Check `packages/core/src/llm/model/provider-registry.json` for the latest models supported by Mastra.

## Scope

- Document how to use technologies with Mastra.
- Do not explain third-party technologies in depth unless the Mastra-specific integration requires it.
- Link to external docs when non-Mastra background is helpful.

## Tone and wording

- Use a neutral, factual tone.
- Do not be funny, whimsical, or story-driven.
- Keep each page self-contained.
- Refer to the reader as `you` when needed.
- Refer to the product as `Mastra`, not `we`, `us`, `our`, or `ours`.
- Do not use `I`.
- Address the reader in the present tense.
- Use sentence case for titles.
- Use conjunctions where they make the sentence sound more natural.
- Write out abbreviations on first use, then add the abbreviation in parentheses.
- Avoid gerunds in titles when a clearer verb phrase works.
- Prefer active voice.
- Prefer imperative instructions.
- Do not write `Let's...` or `Next, we will...`.
- Avoid weak instructions like `You should...` unless you are describing an expected result.
- Use `You can...` only for permission or optional choices.
- When order matters, lead with the location and end with the action.
- Do not wrap instructions in narrative or storytelling.
- When an instruction is opinionated, separate the required action from the opinionated choice used in the example.
- Use `Ensure`, not `make sure`.
- Use exclamation points rarely.

## Links and references

- Link documented APIs on first mention on a page.
- Link them again under a new heading if needed.
- Do not repeat the same reference link over and over in one section.
- When a documented concept needs more detail than fits on the page, link to the relevant reference or doc page instead of duplicating content.

## UI terms

- Bold UI labels, headings, section names, and product names that appear in the interface.
- Use `select` or `open`, not `click`.
- Do not include the word `button` unless it is required for clarity.
- Use `open`, not `appears`, for UI surfaces like modals.

## Code explanations

- Put a short explanation before a code example.
- Use wording like `The following example demonstrates...` when helpful.
- After the code block, explain only what needs explanation.

## Headings

- The page title is H1. New sections start at H2.
- Keep H2 and H3 headings short.
- Do not end headings with punctuation.
- Use code formatting in headings when the same text would be code in body text.
- If a page title contains a function name, wrap the function name in backticks.

## Lists

- Use unordered lists when order does not matter.
- Use ordered lists for sequential steps.
- If list items become long or multi-paragraph, replace the list with headings.
- In list items, use a colon instead of an em dash to separate a label from its description.
- Capitalize the first word after a colon in a list item.
- End full-sentence list items with a period.
- Do not end fragment list items with a period.
- Alphabetize lists when there is no stronger ordering.

## Examples

- Use `for example` for a single example in a sentence.
- Use `e.g.` in parentheses for a list of examples.
- Do not use `e.g.` for a complete list.

## Accessibility

- Do not assume reader proficiency.
- Avoid words like `just`, `easy`, `simple`, `hard`, `beginner`, or `senior` when they judge difficulty or skill level.
- Use as little jargon as possible.
- Define jargon on first use or link to a trusted explanation.

## Code formatting

- Use monospace formatting for code, commands, file names, and URLs.
- Format URLs as links when shown inline.
- Use the correct syntax highlighting for code blocks.
- Use shell syntax for terminal commands.
- Add `npm2yarn` metadata to npm install, npx, and npm run command blocks.

## Quick checks

Before finishing a doc page, check that it:

- stays focused on Mastra
- uses direct, factual language
- avoids repeated reference links
- uses accessible UI wording
- uses correct code formatting and syntax tags
- uses headings and lists that are easy to scan
