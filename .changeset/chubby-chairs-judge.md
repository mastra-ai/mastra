---
'@mastra/factory': minor
---

Added a plans endpoint (POST /web/plans/file) so the web UI can display the markdown content of a plan submitted with submit_plan. The live approval card now fetches and renders the plan while it awaits review, and resolved plan entries render the persisted plan markdown without any extra request. The endpoint only serves relative .md files under .mastracode/plans/.
