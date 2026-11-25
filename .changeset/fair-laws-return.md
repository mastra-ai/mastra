---
'@mastra/playground-ui': minor
---

Reduced how long the workspace file viewer blocks the browser on large or minified files, and added a formatted view for JSON files.

- JSON files open indented, with **Formatted** and **Raw** tabs. Formatting only changes whitespace, so values, key order and large numbers stay exactly as stored. **Raw** shows the file as stored, and the copy button copies the view you are looking at.
- JSON files longer than 50,000 characters open in a read-only editor that keeps syntax colors and draws only the lines on screen, instead of one element per syntax token for the whole file.
- Other code blocks longer than 50,000 characters render as plain text instead of one element per syntax token. This cuts the main-thread work when a large file opens; very large files can still cause a short pause.
- Binary files, such as audio, show "No preview available" instead of their raw bytes.
