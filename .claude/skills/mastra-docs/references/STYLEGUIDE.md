# Documentation styleguide

Use this file as the default writing guide for Mastra documentation. Read the page-specific guide after this one

## Core rules

- Write clearly and directly
- Prefer short sentences, short paragraphs, simple words, and low jargon
- Break up dense text with useful headings, lists, tables, diagrams, or examples
- Write for readers who may be rushed, reading in a non-native language, or new to the ecosystem
- Structure the page around the reader's question or task, not a mandatory template
- Match the established terminology and useful conventions of neighboring pages

## Accuracy

- Verify technical claims against implementation, public types, package exports, and tests
- Treat existing docs as context, not proof that behavior is current
- Test runnable examples when practical
- Include the configuration required by the current API. Do not copy an older example shape without checking source
- Confirm import paths, option names, defaults, return values, environment variables, and version requirements

## Scope

- Document how to use technologies with Mastra
- Explain third-party technology only as far as the Mastra integration requires
- Link to external documentation for background or product-specific details
- Link to reference pages for exhaustive API detail instead of duplicating it

## Writing style

Vary prose naturally:

- Mix sentence and paragraph lengths
- Avoid the "topic sentence, three supporting points, conclusion" formula
- Don't start consecutive paragraphs or sentences with the same word
- Skip conclusion wrappers. End when the page has completed its job
- State the point without hedging or rhetorical wind-up
- Avoid AI vocabulary fingerprints such as "delve," "tapestry," "multifaceted," "leverage," "foster," "underscores," "comprehensive," and "robust."
- Remove filler such as "It's important to note" and "in order to."
- Use commas or periods instead of em dashes
- Prefer simple words: "use" instead of "utilize," and "help" instead of "facilitate."
- Use a neutral, factual tone
- Do not be funny, whimsical, sycophantic, or story-driven
- Keep each page self-contained
- Refer to the reader as `you` when needed
- Refer to the product as `Mastra`, not `we`, `us`, `our`, or `ours`
- Do not use `I`
- Address the reader in the present tense
- Use sentence case for titles and headings
- Use contractions for common phrases such as `don't`, `doesn't`, `can't`, and `isn't`
- Remove weak adverbs, weasel words, clichés, and wordy phrases
- Do not start sentences with `So`, `There is`, or `There are`
- Use inclusive, gender-neutral, person-first wording
- Write out abbreviations on first use, then add the abbreviation in parentheses
- Avoid gerunds in titles when a clearer verb phrase works
- Prefer active voice and imperative instructions
- Do not write `Let's...` or `Next, we will...`
- Avoid `You should...` unless describing an expected result
- Use `You can...` for permission or optional choices
- When order matters, lead with the location and end with the action
- Separate required actions from opinionated choices used in examples
- Use `Ensure`, not `make sure`
- Use exclamation points rarely
- Do not use "Alpha" to mark early-stage features. Use "Beta" when a label is required

## Openings and endings

- Open with what the subject does, what the reader can accomplish, or the decision the page helps them make
- Keep the opening short, but use more than two sentences when the page needs scope or prerequisites
- Do not begin every page with "In this guide" or another fixed formula
- Add `Next steps`, `Related`, or another final section only when the links help readers continue
- Do not add congratulations text

## Task-oriented instructions

- State the intended result before the first action
- Put prerequisites near the first action that requires them
- Present required actions in dependency order
- Reach a working result before introducing optional branches or advanced configuration
- Include a command, URL, interface action, or expected output that verifies the result

## Links and references

- Link an API or concept on first mention when a canonical page exists
- Link it again under a new heading only when readers may enter at that section
- Do not repeat the same reference link throughout one section
- Use root-relative internal links
- Link to the final canonical route, not a redirect source
- Use descriptive link text that still reads naturally after a route move

## UI terms

- Bold UI labels, headings, section names, and product names that appear in the interface
- Use `select` or `open`, not `click`
- Do not include the word `button` unless it is required for clarity
- Use `open`, not `appears`, for UI surfaces such as dialogs

## Code examples

- Introduce code with a short explanation of its purpose
- Put complete code at the point readers need it
- Include imports and file paths when readers create or replace a file
- Explain only the non-obvious parts after the code block
- Keep examples consistent across a page unless the change itself is being demonstrated
- Use realistic names and supported package versions
- Avoid comments that merely restate the next line

## Headings

- The page title is H1. New sections start at H2
- Keep headings short and descriptive
- Use headings that describe what readers will understand, configure, or accomplish
- Do not end headings with punctuation
- Use code formatting when the heading text is code in body text
- Wrap function names in backticks
- Do not force a heading solely to satisfy a template

## Lists

- Use unordered lists when order does not matter
- Use ordered lists when actions must happen in sequence
- Replace long, multi-paragraph list items with headings or `Steps`
- Use a colon instead of an em dash between a label and description
- Capitalize the first word after a colon in a list item
- End full-sentence list items with a period
- Do not end fragment list items with a period
- Alphabetize only when no stronger order exists

## Examples

- Use `for example` for one example in a sentence
- Use `e.g.` in parentheses for a partial list
- Do not use `e.g.` for a complete list

## Accessibility

- Do not assume reader proficiency
- Avoid words such as `just`, `easy`, `simple`, `hard`, `beginner`, or `senior` when they judge difficulty or skill level
- Define jargon on first use or link to a trusted explanation
- Use meaningful link text and empty alt text for decorative images

## Code formatting

- Use monospace formatting for code, commands, file names, environment variables, and literal URLs
- Format URLs as links when shown inline
- Use the correct syntax highlighting for code blocks
- Use `bash` for terminal commands
- Add `npm2yarn` metadata to npm install, npx, and npm run command blocks
- Add a `title` to code blocks when the file path matters
- Use line highlighting only when it directs attention to the relevant change
