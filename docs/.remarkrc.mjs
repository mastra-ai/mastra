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
import remarkLintNoHeadingPunctuation from 'remark-lint-no-heading-punctuation';
import remarkLintOrderedListMarkerValue from 'remark-lint-ordered-list-marker-value';
import remarkLintUnorderedListMarkerStyle from 'remark-lint-unordered-list-marker-style';
import remarkLintListItemIndent from 'remark-lint-list-item-indent';

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
    [remarkLintNoHeadingPunctuation, 'warn'],

    // Lists — styleguide: unordered use "-", ordered use sequential values
    [remarkLintUnorderedListMarkerStyle, '-'],
    [remarkLintOrderedListMarkerValue, 'ordered'],
    [remarkLintListItemIndent, 'one'],
  ],
};

export default config;
