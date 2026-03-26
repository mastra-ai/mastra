---
'mastra': patch
---

Restructured Studio sidebar navigation into section-based layout with overview pages.

- **Section headers**: Sidebar now groups links under "Primitives", "Evaluation", and "Observability" section headers. Headers are clickable and link to overview pages.
- **Sub-link indentation**: Links within each section are visually indented when the sidebar is expanded.
- **Overview pages**: New overview pages for Primitives (`/primitives`), Observability (`/observability-overview`), and Resources (`/resources`) showing clickable cards for each sub-section.
- **Evaluation tab bar removed**: Scorers, Datasets, and Experiments are now navigated via sidebar sub-links instead of in-page tabs.
- **Layout cleanup**: Removed grey `bg-surface2` panel styling from the main content area, applying the dark background universally. Cleaned up experimental UI gating code.
- **Sidebar bottom**: Removed "Share" button (moved to Resources page) and "Templates" link. Sidebar bottom now only shows the version footer.
