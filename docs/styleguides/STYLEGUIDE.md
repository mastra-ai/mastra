# Documentation Styleguide

These are the guidelines for writing Mastra documentation. Please use the following as a general guideline, and understand that contributions may be edited to match existing style, tone, conventions, and structure.

## Readability

All readers benefit from clear, straightforward writing, but this is particularly important for people who:

- Read documentation in a non-native language.
- Are frustrated, tired, or in a hurry.
- Have cognitive, learning, or attention difficulties.
- Come from a non-traditional development background.

Choose:

- Shorter sentences and paragraphs.
- Simpler vocabulary and phrases.
- Less jargon.
- Fewer assumptions about what the reader already knows.
- Bullet points and section headings to break up chunks of text.

You can check your writing by pasting it into [Hemingway App](https://hemingwayapp.com/). It will flag overly long sentences and encourage you to use active voice, which is generally shorter and easier to read.

Also see tips on how to [write inclusive documentation](https://developers.google.com/style/inclusive-documentation) and [write accessible documentation](https://developers.google.com/style/accessibility).

## Content

### Only document how Mastra works

It isn't the role of Mastra docs to document how React, Coding Agents, or other technologies work. It **is** our role to document how to use those technologies **with Mastra**.

Link to external sources when information about other technologies may be helpful.

### Write in a neutral, factual tone

State facts directly. Do not try to be funny or whimsical. Use a neutral tone that is calm, friendly, respectful, and assuring, but not overly casual. Do not talk down to the reader, and do not make assumptions about what they already know.

> ❌ Memory is like magical fairy godmothers that bring your agent to life with a wave of their wand!

> ✅ Memory can be used to store and retrieve information that your agent can use to make informed decisions and take meaningful actions.

Each piece of content should be standalone — do not incorporate characters as guides or try to "tell a story" throughout the docs.

### Avoid "we/us/our/ours"

Refer to the reader with "you/your/yours." Refer to Mastra as "Mastra," not "we/us/our/ours."

> ❌ Our primitives are designed to be flexible and composable. Let's take a look at how to use them.

> ✅ Mastra's primitives are designed to be flexible and composable. Import them into your project.

### Address the reader in the present tense

When addressing the reader, use the present tense. Do not include yourself.

> ✅ You can now safely delete this line of code.

> ✅ Delete this line of code. It is no longer needed.

Never use _I_. Mastra docs are not about what you (the author) can do.

### Use sentence-case for titles

> ❌ How to Set up Memory

> ✅ How to set up memory

### Use conjunctions

Use conjunctions to make the copy sound more natural.

> ❌ You will need to install the package.

> ✅ You'll need to install the package.

### Write out abbreviations when introducing them

Write out the term in full first, then put the abbreviation in parentheses. Make abbreviations plural by treating them as regular words (e.g. APIs, IDEs, OSes).

> ❌ An AST is a tree representation of code. AST's are a fundamental part of the way a compiler works.

> ✅ An abstract syntax tree (AST) is a tree representation of code. ASTs are a fundamental part of the way a compiler works.

### Avoid gerunds (-ing words)

English gerunds ("-ing" words like "running") turn verbs into nouns. This makes sentences sound passive and harder to translate. Use an active voice as much as possible.

> ❌ Using a voice library with Mastra

> ✅ How to use a voice library with Mastra

### Use active voice

Use active verbs that put the reader in the first person instead of passive "be" verbs that describe actions as a state of being (is/was/to be).

> ❌ The `index.ts` file should be created in the `src/mastra` folder of your application.

> ✅ Create the `index.ts` file in the `src/mastra` folder of your application.

### Use imperative (command) tense for instructions

Give the reader a direct instruction whenever possible.

> ✅ Run the following command.

Do not use _"Let's..."_ or _"Next, we will..."_. You are not sitting there with your reader.

If you must address the reader, it is OK to use "you" and "your." In particular, use this for emphasis in important steps where something could go wrong:

> ✅ Before continuing, you must check your configuration or else the build will fail.

### Avoid words that cause doubt

Certain words and phrases are problematic in instructions:

- **"You should..."** — Avoid this phrase most of the time. The reader may wonder: "Do I have to? What happens if I don't?" You _can_ use this phrase when describing what the reader should be experiencing (e.g. after a successful installation), but even then it's almost always possible to rephrase.

  > ❌ If the installation was successful, you should see a prompt to continue.

  > ✅ After a successful installation, a prompt to continue will appear.

- **"You can..."** — Use this phrase **only** to give permission or state that an option exists. Do not use this in general instructions that you expect the reader to follow.

### Lead with location; end with action

When learners are performing an order of operations, start with _where_ they need to be to perform the action.

> ❌ Open your `.env` file in your project's root folder.

> ✅ In your project's root folder, open your `.env` file.

### Avoid storytelling in instructions

Recipes and instructional content should be a set of instructions stated as concisely and directly as possible. Do not tell a story around what is happening. If needed, provide brief context in the form of a goal, benefit, or reason.

> ❌
> As well as needing your content in different languages, you will often need to translate labels for UI elements around your site. We can do this by creating dictionaries of terms instead of hard-coding text in one language in our templates.
>
> 1. ...

> ✅
> Create dictionaries of terms to translate the labels for UI elements around your site. This allows your visitors to experience your site fully in their language.
>
> 1. ...

### Opinionated instructions

When an instruction can be completed in a variety of ways (e.g. choose a UI framework), separate the instruction from the opinion:

1. Give the action to take with the reason, goal, or criteria.
2. State the opinionated choice that your example uses.

The reader will first process what you're doing and then see the choice you've made. They can follow your instruction, making a choice that works for their own project.

> ❌ Add the `LanguagePicker` component to your site. A good place might be in a navigation component or a footer shown on every page.

> ✅ Add the `LanguagePicker` component to your site in a component that is shown on every page. The example below adds this to the page footer:

### De-dupe reference links

When mentioning a documented component, function, etc. multiple times on a page, link to the reference documentation on the **first mention** of that item. The exception is when the reference is mentioned under a different heading — in that case, link to the reference documentation again.

> ❌ The [`generate()`](/docs/reference) function returns the [`Message`](/docs/reference). The following example uses the [`generate()`](/docs/reference) function to access the [`Message`](/docs/reference).

> ✅ The [`generate()`](/docs/reference) function returns the [`Message`](/docs/reference). The following example uses the `generate()` helper to access the `Message`.

### Bold UI elements

Bold proper nouns found in the UI, such as titles, headings, and product names.

> ❌
> In the Azure services section, select Microsoft Entra ID.

> ✅
> In the **Azure services** section, select **Microsoft Entra ID**.

### Syntax for code example explanations

Code examples should always have an explanation preceding them. Typically, they begin with something along the lines of "The following example demonstrates..."

> ❌ You might have already configured storage. Ensure that `new Mastra()` is using it.

> ✅ The following example demonstrates how to configure storage. The `new Mastra()` constructor is passed a storage configuration object that specifies the storage provider and any necessary credentials.

### "Ensure" instead of "make sure"

> ❌ Make sure you have the correct permissions.

> ✅ Ensure you have the correct permissions.

### Exclamation points

It's OK to use exclamation points occasionally, but only when emphasizing something that is truly exciting, surprising, or to be encouraging. If you're not sure, use a period instead.

Exclamation points can send "positive vibes" to the reader, but if a reader is frustrated, confused, or in a serious state of mind, they can seem insensitive. Do not use too many.

## Headings

- New sections start at the `<h2>` level. The page title is an `<h1>` element.
- Keep headings short. `<h2>` and `<h3>` headings appear in the right sidebar / "On this page" menu. Preview the sidebar in the browser and rephrase to shorten headings if the entry looks too long.
- Do not end headings with punctuation (e.g. ":").
- Format text as `<code>` in headings that would normally be formatted as code in regular paragraphs.

### Use backticks for function references in page titles

When writing titles that contain function references, wrap the function name in backticks.

> ❌ title: `generate()`

> ✅ title: `` `generate()` ``

## Lists

Use lists for a group of related items, such as a complete set of configuration options or object properties. When individual line items become large, span multiple paragraphs, or contain too many code terms affecting readability, switch to section headings.

- Use unordered (bulleted) lists when the order of the items is not important.
- Use ordered (numbered) lists when giving steps or instructions to be followed in sequence.

### List item punctuation

When list items are full sentences, end with a period.

> ❌
>
> - Select **Save**
> - The system sends you a confirmation email

> ✅
>
> - Select **Save**.
> - The system sends you a confirmation email.

When list items aren't full sentences, don't use a period.

> ❌
>
> - Name.
> - Email.
> - Password.

> ✅
>
> - Name
> - Email
> - Password

### Alphabetize

Keep items in alphabetical order when there is no other logical ordering.

## Examples

Use the words "for example" in full when writing a clause to introduce a single example situation.

> For example, when passing props...

Give lists of examples (e.g. frameworks, attributes) separated by commas inside parentheses. Use "e.g." as the abbreviation for "example."

> If you store your project in an online Git provider (e.g. GitHub, GitLab), you can...

> **Note:** Examples are **some** (but not all) possible options. If your list contains **every possibility**, it is no longer a list of "examples." To provide a complete list, use parentheses without "e.g.":
>
> Include the required image properties (`src`, `alt`) and any additional optional properties.

## Accessibility

### Do not assume proficiency

Avoid using language that assumes someone's level of proficiency. Something difficult for a beginner may not be difficult for a senior engineer. This language can inadvertently alienate or insult a learner. Avoid words like "just," "easy," "simple," "senior," "hard."

Use as little jargon as necessary. Describe jargon in parentheses on first reference or link to a trusted definition.

> ❌ It's _easy_ to build your app with Mastra!

> ✅ You can build your app with Mastra in three steps.

> ❌ Mastra works great with any UI framework.

> ✅ Mastra supports multiple UI frameworks, including React, Vue, and Angular.

### Avoid "click"

"Click" assumes the learner is using a mouse. Learners may navigate by touchscreen, keyboard, or assistive technology. Use "select" or "open" instead.

> ❌ Click the **Settings** tab.

> ✅ Open the **Settings** tab.

> ❌ Click the **Deploy** option.

> ✅ Select the **Deploy** option.

### Avoid using "button"

> ❌ Select the **New secret** button.

> ✅ Select **New secret**.

### Avoid "appears"

> ❌ A modal will appear.

> ✅ A modal will open.

## Code

### Use monospace fonts for code, commands, file names, and URLs

> ❌ Copy the environment variables to your .env file.

> ✅ Copy the environment variables to your `.env` file.

> ❌ In your browser, open http://localhost:3000/.

> ✅ In your browser, open [`http://localhost:3000/`](http://localhost:3000/).

### Specify syntax and filename for terminal commands

If the code should run in a terminal, set the code block's syntax highlighting and filename appropriately.

> ❌

````
```
npm i @mastra/core
```
````

> ✅

````
```sh filename="terminal"
npm i @mastra/core
```
````
