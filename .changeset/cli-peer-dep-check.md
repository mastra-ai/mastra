---
'mastra': patch
---

Added peer dependency version validation when running `mastra dev`. The CLI now checks if installed @mastra/* packages satisfy each other's peer dependency requirements and displays a warning with upgrade instructions when mismatches are detected.
