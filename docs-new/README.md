# Mastra Docusaurus Test

This is a test migration of the Mastra documentation from Nextra to Docusaurus.

## What's included

This test setup includes:

### Fonts
- **Inter** - Primary font for body text (via Google Fonts)
- **Geist Mono** - Monospace font for code blocks (via Google Fonts)
- Custom Mastra green color theme

### Migrated Pages
- `docs/intro.md` - Introduction/Overview page
- `docs/agents/overview.md` - Complete agents documentation with admonitions
- `docs/workflows/overview.md` - Complete workflows overview with all sections
- `docs/getting-started/installation.md` - Installation guide with Docusaurus Tabs
- `docs/tools-mcp/overview.md` - Tools overview documentation

### Configuration
- Basic Docusaurus configuration (`docusaurus.config.js`)
- Google Fonts preconnect links
- Custom CSS with Inter and Geist Mono fonts (`src/css/custom.css`)
- Homepage (`src/pages/index.js`)
- All referenced images in `/static/img/`

## Installation

First, install dependencies:

```bash
npm install
# or
pnpm install
```

## Development

Start the development server:

```bash
npm start
# or
pnpm start
```

This will open [http://localhost:3000](http://localhost:3000) in your browser.

## Key Differences from Nextra

### 1. Component Syntax

**Nextra:**
```mdx
import { Callout, Tabs, Steps } from "nextra/components";

<Callout type="info">
  This is an info callout
</Callout>

<Tabs items={["Tab 1", "Tab 2"]}>
  <Tabs.Tab>Content 1</Tabs.Tab>
  <Tabs.Tab>Content 2</Tabs.Tab>
</Tabs>

<Steps>
### Step 1
...
### Step 2
...
</Steps>
```

**Docusaurus:**
```mdx
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

:::info
This is an info callout
:::

<Tabs groupId="package-manager">
  <TabItem value="npm" label="npm" default>
  Content 1
  </TabItem>
  <TabItem value="yarn" label="yarn">
  Content 2
  </TabItem>
</Tabs>

<!-- Steps converted to numbered headings -->
### 1. Step title
...
### 2. Step title
...
```

### 2. File Structure

**Nextra:**
- Content in `src/content/en/docs/`
- Uses `_meta.ts` for sidebar configuration
- Uses `.mdx` files

**Docusaurus:**
- Content in `docs/`
- Uses `sidebars.js` for sidebar configuration
- Can use both `.md` and `.mdx` files
- Uses frontmatter for page metadata

### 3. Frontmatter

**Nextra:**
```yaml
---
title: "Page Title | Section | Mastra Docs"
description: "Page description"
---
```

**Docusaurus:**
```yaml
---
sidebar_position: 1
title: Page Title
description: Page description
---
```

### 4. Fonts

**Implementation:**
- Added Google Fonts preconnect in `docusaurus.config.js` via `headTags`
- Imported Inter and Geist Mono in `custom.css`
- Set `--ifm-font-family-base` and `--ifm-font-family-monospace` CSS variables
- Custom Mastra green theme colors for both light and dark modes

## Migration Checklist

When migrating the full documentation, you'll need to:

- [ ] Convert all Nextra components to Docusaurus equivalents
- [ ] Update internal links (`.mdx` → `.md`)
- [ ] Convert `_meta.ts` structure to `sidebars.js`
- [ ] Update frontmatter format
- [ ] Copy/adapt images and static assets
- [ ] Set up custom components for advanced features
- [ ] Configure search (Algolia)
- [ ] Set up internationalization if needed
- [ ] Update deployment configuration

## Next Steps

1. Review the migrated pages in the browser
2. Test the sidebar navigation
3. Experiment with adding more pages
4. Try customizing the theme
5. Set up any custom MDX components you need

## Resources

- [Docusaurus Documentation](https://docusaurus.io/docs)
- [Creating Pages](https://docusaurus.io/docs/creating-pages)
- [Markdown Features](https://docusaurus.io/docs/markdown-features)
- [Styling and Layout](https://docusaurus.io/docs/styling-layout)
