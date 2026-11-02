---
'@mastra/playground-ui': patch
---

The Knowledge explorer now turns `[[links]]` in page bodies into links. A link such as `[[docs:mastra#workflows/suspend-and-resume]]` shows the target page's name and opens that page when clicked; a link to a page that isn't loaded shows as quiet, unlinked text. Links inside code are left as written.

The graph also draws these body links as thin green lines between pages, with a "Linked in page body" legend row, so you can see how pages reference each other alongside parent → child lines and note mentions.

`MarkdownRenderer` accepts optional `remarkPlugins` and `components` props, added after its built-in ones, so a host can render custom syntax without losing the renderer's escaping.
