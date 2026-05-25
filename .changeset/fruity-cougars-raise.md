---
'@mastra/playground-ui': patch
---

Fixed Studio Settings page (and other default-height `PageLayout` pages) clipping their content with no scrollbar on viewports shorter than the form. Users on short laptop screens (under ~991px tall) could not reach the Save button under the Mastra Connection headers form, making it impossible to apply changes. Default-height `PageLayout` pages now grow with their content and scroll through the studio chrome wrapper; `height="full"` pages (Logs, Traces, Metrics, etc.) are unchanged.
