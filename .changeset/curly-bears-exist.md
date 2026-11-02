---
'mastra': patch
---

Fixed CLI sign-in when the terminal runs on another machine (SSH, containers, cloud dev boxes). `mastra auth login` and `create-mastra` now always print the sign-in link, and if the browser can't reach the CLI after you sign in, you can paste the page's URL into the terminal to finish.
