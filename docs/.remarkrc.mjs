/**
 * Remark-lint configuration for Mastra docs.
 */
import remarkFrontmatter from 'remark-frontmatter';
import remarkMdx from 'remark-mdx';
import remarkPresetLintConsistent from 'remark-preset-lint-consistent';
import remarkPresetLintRecommended from 'remark-preset-lint-recommended';
import remarkLintHeadingIncrement from 'remark-lint-heading-increment';
import remarkLintNoDuplicateHeadings from 'remark-lint-no-duplicate-headings';
import remarkLintNoEmphasisAsHeading from 'remark-lint-no-emphasis-as-heading';

import remarkLintOrderedListMarkerValue from 'remark-lint-ordered-list-marker-value';
import remarkLintUnorderedListMarkerStyle from 'remark-lint-unordered-list-marker-style';

const config = {
  plugins: [
    // Enable parsing of frontmatter and MDX so they don't cause false positives
    remarkFrontmatter,
    remarkMdx,

    // Presets
    remarkPresetLintConsistent,
    remarkPresetLintRecommended,

    // Headings
    [remarkLintHeadingIncrement, 'error'],
    [remarkLintNoDuplicateHeadings, 'error'],
    [remarkLintNoEmphasisAsHeading, 'error'],

    // Styleguides
    [remarkLintUnorderedListMarkerStyle, '-'],
    [remarkLintOrderedListMarkerValue, 'one'],
  ],
};

export default config;
