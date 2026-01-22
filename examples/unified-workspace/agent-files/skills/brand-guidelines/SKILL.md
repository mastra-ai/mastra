---
name: brand-guidelines
description: Define, explain, and enforce brand voice, tone, and visual guidelines across all content and assets. Use this when a user asks for brand voice creation, refinement, or consistency checks.
license: Apache-2.0
metadata:
  author: example-org
  version: '1.0'
---

# Brand Guidelines Skill

Use this skill to help users define, refine, and apply brand guidelines consistently across written and simple visual deliverables.

## When to use this skill

Activate this skill when the user:

- Wants to create or update a brand voice, tone of voice, or messaging guidelines
- Asks you to "sound like" or "write in the style of" a particular brand or persona
- Provides an existing style guide, brand book, or samples of on-brand / off-brand content
- Requests a consistency check or brand alignment review of copy, scripts, or UX text
- Needs a written summary of their brand guidelines for teammates or vendors

## Core workflow

1. **Clarify the brand context**
   - Ask about industry, target audience, key value proposition, and markets
   - Ask if they have existing materials: website, sales deck, brand book, prior campaigns
   - Ask what _already works_ for them and what feels off-brand

2. **Collect brand inputs**
   - If the user shares samples, identify:
     - Common phrases, patterns, and framing
     - Formality level and emotional intensity
     - Point of view (first person, second person, etc.)
     - Typical content formats (emails, landing pages, ads, support docs)
   - If no samples are provided, co-create based on their answers to structured questions

3. **Define a concise brand summary**
   Capture a short, reusable snapshot before going deep:
   - Brand essence (1–2 sentences)
   - Target audience (who, what they care about)
   - Positioning (how this brand is different)
   - Tone pillars (3–5 adjectives with 1 sentence each)

4. **Create detailed voice & tone guidelines**

   For most brands, include the following sections. Use bullets and concrete examples.
   - **Voice pillars** – 3–5 core traits that should almost never change
   - **Tone variations by context** – how tone shifts for:
     - Marketing / acquisition
     - Product / UX
     - Support / help center
     - Legal / policy (if applicable)
   - **Do / Don't tables** – show side-by-side examples of on-brand vs off-brand phrases
   - **Vocabulary** – words and phrases to prefer, avoid, or require (taglines, product names, capitalization rules)
   - **Formatting preferences** – sentence length, use of bullets, headings, emojis, contractions, jargon
   - **Language constraints** – inclusive language rules, regional spelling, banned phrases

5. **Create reusable prompts / instructions**

   When the user wants to apply the brand across tools or teams, provide:
   - A compact "brand voice prompt" (3–10 lines) that can be pasted into other systems
   - Quick-reference bullet list of do's and don'ts
   - Optional: variants tailored for short-form social, long-form content, and support replies

6. **Apply the guidelines to specific tasks**

   When asked to write or review content:
   - Restate the relevant parts of the guidelines briefly
   - For new content, draft 2–3 options when helpful (e.g., conservative vs bold)
   - For revisions, show:
     - The original
     - The revised, on-brand version
     - A short note explaining key changes in terms of the guidelines

7. **Iterate with the user**
   - Encourage the user to mark lines or sections that feel especially on- or off-brand
   - Update the guidelines to reflect this feedback
   - Keep the final version structured and easy to scan

## Recommended sections for a brand guide

When producing a full brand guideline document, use headings like:

1. **Brand overview**
   - Mission
   - Vision
   - Elevator pitch

2. **Audience & positioning**
   - Primary audiences
   - Pain points and goals
   - Brand promise and differentiators

3. **Voice & tone**
   - Core voice pillars
   - Tone by channel/context
   - Personality spectrum (e.g., Formal ↔ Casual, Serious ↔ Playful)

4. **Messaging framework**
   - Key messages / proof points
   - Tagline(s) and boilerplate copy
   - Short and long descriptions (e.g., 1-sentence, 50-word, 150-word)

5. **Language and style rules**
   - Grammar and style references (e.g., follow AP style with specific exceptions)
   - Regional spelling (e.g., US vs UK English)
   - Inclusive language standards

6. **Examples**
   - On-brand examples with explanations
   - Off-brand examples with corrections

7. **Practical checklists**
   - Pre-publish checklist for any new piece of content
   - Quick rules for adapting content between channels (e.g., blog → LinkedIn → email)

## Example interaction flow

Below is a sample dialog structure you can adapt.

**Step 1 – Diagnose the need**

- "Are you looking to create a new brand voice from scratch, or refine an existing one?"
- "Do you have any examples of content that feels exactly right for your brand?"
- "Who are your primary audiences, and where will this content mostly appear?"

**Step 2 – Build the foundation**

Ask questions like:

- "How do you want your brand to make people feel?"
- "If your brand were a person, how would friends describe them in 3–5 words?"
- "What do you absolutely _not_ want your brand to sound like?"

**Step 3 – Present a first draft of guidelines**

Provide a structured document with the sections above. Invite targeted feedback:

- "Please highlight any phrases or sections that feel especially right or wrong."
- "Should we dial the tone more formal, more playful, or somewhere in between?"

**Step 4 – Refine and operationalize**

- Update the guide based on feedback
- Produce:
  - A 1-page summary
  - A copy-and-paste prompt for other tools
  - A short checklist writers can use before publishing

## Edge cases and special situations

- **Multiple sub-brands or products**: Create a shared core voice, then specific variations per sub-brand.
- **Highly regulated industries**: Add a section on compliance constraints and escalation rules.
- **Non-English brands**: Ask whether to localize tone per market or keep a unified global voice.
- **Rebrands in progress**: Mark which parts are stable vs experimental so teams know what may still change.

## File references

This skill has no additional reference or asset files yet. If it grows in complexity, add:

- `references/REFERENCE.md` for extended examples
- `assets/` for visual brand components like color palettes and logo usage rules
