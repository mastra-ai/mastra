# Documentation components

Use shared components when they encode an established documentation or extraction pattern. Check `docs/CONTRIBUTING.md` and existing usage before introducing new markup.

## `CardGrid` and `CardGridItem`

Use `CardGrid` for a curated set of destinations whose labels, descriptions, and order belong to the current page.

```mdx
import { CardGrid, CardGridItem } from '@site/src/components/cards/card-grid';

<CardGrid columns={3}>
  <CardGridItem title="Agents" description="Create model-powered agents." href="/docs/agents/overview" />
</CardGrid>
```

Do not recreate card borders, links, or grid layout by hand. The shared component provides consistent visual behavior and card-grid data slots for llms-txt extraction.

## `IntegrationGrid`

Use `IntegrationGrid` when entries come from `docs/src/content/en/integrations/sidebars.js`.

```mdx
import { IntegrationGrid } from '@site/src/components/integrations/grid';

<IntegrationGrid section="Frameworks" allowlist={['frameworks/next-js', 'frameworks/astro']} />
```

Available controls include:

- `section`: The integration sidebar category.
- `allowlist`: Entries to include, in the requested order where supported.
- `blocklist`: Entries to exclude.
- `additionalItems`: Sidebar-shaped entries that do not have their own integration page.
- `columns`: A three- or four-column layout.

The integration sidebar remains the source of truth for labels, routes, ordering, and icons. Do not copy that metadata into MDX.

## `Steps` and `StepItem`

Use `Steps` when the reader must complete actions in sequence and each action needs substantial prose, code, or admonitions. Use a Markdown ordered list for short steps.

Do not use `Steps` merely to make unrelated sections look procedural.

## `Tabs` and `TabItem`

Use tabs for mutually exclusive alternatives, such as package managers, runtimes, frameworks, or backend choices. Keep shared setup outside the tabs.

Do not hide sequential instructions in tabs. Do not create tabs when readers need to compare both examples at once.

## `PropertiesTable`

Use `PropertiesTable` for structured API parameters, properties, configuration, and nested types. Follow current reference pages for the supported object shape.

For nested parameter groups, place `parameters` inside an entry with a `type`:

```mdx
<PropertiesTable
  content={[
    {
      name: 'options',
      type: 'RunOptions',
      description: 'Options for the run.',
      properties: [
        {
          type: 'RunOptions',
          parameters: [
            {
              name: 'timeout',
              type: 'number',
              description: 'Timeout in milliseconds.',
              isOptional: true,
            },
          ],
        },
      ],
    },
  ]}
/>
```

## `CopyPrompt`

Use `CopyPrompt` when a page provides a self-contained prompt that an AI coding tool can follow. The prompt should name the intended result, relevant files, and constraints. Do not use it as a substitute for readable human instructions.

## `Inject`

Use `Inject` for short, essential instructions that specifically help an AI agent apply the surrounding documentation. Keep the normal page complete for human readers.

## llms-txt controls

- Add `data-llms-ignore` to rendered controls or interface text that should not appear in extracted documentation.
- Preserve `data-slot="card-grid"`, `data-slot="card"`, and `data-slot="card-title"` when extending card markup recognized by the llms-txt plugin.
- Prefer semantic HTML, including `ul` and `li`, when it accurately represents the content.
- Test the generated section when changing extraction-aware markup.

## Admonitions

Use admonitions for information that deserves visual separation:

- `note`: Scope, compatibility, or supporting context.
- `warning`: A likely failure mode, security concern, or destructive consequence.
- `danger`: A severe and immediate risk.
- `beta`: A feature explicitly presented as Beta.

Do not place routine instructions in admonitions. Use the `beta` admonition only for features presented as Beta.
