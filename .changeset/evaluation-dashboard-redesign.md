---
'@mastra/playground-ui': minor
---

Redesigned the Evaluation dashboard with new list views, review pipeline, and dataset-level review tab.

**Evaluation dashboard**
- Replaced table-based list views with the new `EntityList` design system for Scorers, Datasets, and Experiments tabs.
- Moved charts to an Overview tab and list views to dedicated tabs (Scorers, Datasets, Experiments). Tabs are now driven by sidebar navigation instead of an in-page tab bar.
- Added per-tab filter toolbars with search, status filters, and tag filters.
- Added "Create Dataset" button to Datasets tab.
- Added "Needs Review" KPI card and "Review Pipeline" chart to the Overview tab.

**Dataset review tab**
- New "Review" tab on the dataset detail page for reviewing experiment results across all agents targeting that dataset.
- Extracted shared review components (`ReviewItemCard`, `TagPicker`, `BulkTagPicker`, `ProposalTag`) into a reusable `review` domain.
- LLM-powered failure clustering and tag proposal integrated into dataset-level review.
- Tag-based filtering, bulk operations, ratings, and comments.

**Other improvements**
- Dataset tags displayed in a dedicated column with truncation and hover tooltip.
- Experiment result panel now shows review status badge and tags.
- Scores-over-time chart uses adaptive time bucketing (minute/hour/day) and shows date labels for multi-day ranges.
- Bar chart labels repositioned above bars for better contrast.
- Breadcrumbs across dataset and experiment pages updated to use `/evaluation/` prefix.

**Sidebar design system**
- `MainSidebarNavHeader` now supports an optional `href` prop for clickable section headers, and an `isActive` prop for header highlighting.
- `MainSidebarNavLink` now supports an optional `indent` prop for sub-link indentation.
