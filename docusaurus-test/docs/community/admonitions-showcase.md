# Admonitions Showcase

This page demonstrates all available admonition types in Docusaurus for styling reference.

## Basic Admonitions

### Note

This is just some content

:::note
This is a **note** admonition. Use it for general information that doesn't fit other categories.

Some additional content with _Markdown_ `syntax`. Check [this api](#).
:::

:::note[Custom Note Title]
You can also specify a custom title for note admonitions.
:::

### Tip

:::tip
This is a **tip** admonition. Use it for helpful suggestions or best practices.

Some additional content with _Markdown_ `syntax`. Check [this api](#).
:::

:::tip[Pro Tip]
You can customize the title to make it more specific to your use case.
:::

### Info

:::info
This is an **info** admonition. Use it for neutral information.

Some additional content with _Markdown_ `syntax`. Check [this api](#).
:::

:::info[Important Information]
Info admonitions are great for highlighting key details without alarm.
:::

### Warning

:::warning
This is a **warning** admonition. Use it to alert users about potential issues.

Some additional content with _Markdown_ `syntax`. Check [this api](#).
:::

:::warning[Caution Required]
Custom titles help make warnings more specific and actionable.
:::

### Danger

:::danger
This is a **danger** admonition. Use it for critical warnings or breaking changes.

Some additional content with _Markdown_ `syntax`. Check [this api](#).
:::

:::danger[Breaking Change]
Danger admonitions should be used sparingly for the most critical warnings.
:::

## Nested Admonitions

Admonitions can be nested using more colons for each level:

:::::info[Parent Admonition]

This is the parent content.

::::warning[Child Admonition]

This is nested inside the info admonition.

:::danger[Deeply Nested]

You can nest multiple levels deep if needed.

:::

::::

:::::

## Admonitions with Rich Content

:::tip[Feature Rich]

Admonitions support full Markdown syntax:

- **Bold text**
- _Italic text_
- `Inline code`
- [Links](#)

You can also include:

1. Ordered lists
2. With multiple items
3. And proper formatting

```javascript
// Code blocks work too!
function example() {
  console.log('Hello from inside an admonition');
}
```

> Blockquotes are also supported

:::

## Multiple Admonitions in Sequence

:::note
First admonition with some information.
:::

:::tip
Followed by a helpful tip.
:::

:::warning
And then a warning to watch out for.
:::

## Long Content Example

:::info[Detailed Information]

This admonition contains a lot of content to demonstrate how they look with longer text.

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.

### Subheading Inside Admonition

You can even include headings inside admonitions:

- Point one with detailed explanation
- Point two with more context
- Point three wrapping up the section

Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.

:::

## Empty Admonitions

:::note
:::

:::tip
:::

:::info
:::

:::warning
:::

:::danger
:::

## Admonitions with Inline Elements

:::note
This admonition has **bold**, _italic_, `code`, and [link](#) elements all inline with regular text to test spacing and styling.
:::

## All Types Side by Side for Comparison

Here are all five types with identical content for easy visual comparison:

:::note
This is test content to compare styling across different admonition types.
:::

:::tip
This is test content to compare styling across different admonition types.
:::

:::info
This is test content to compare styling across different admonition types.
:::

:::warning
This is test content to compare styling across different admonition types.
:::

:::danger
This is test content to compare styling across different admonition types.
:::
