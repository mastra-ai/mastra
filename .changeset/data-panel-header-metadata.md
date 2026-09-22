---
'@mastra/playground-ui': minor
---

Align `DataPanel.Header` with the page `Header` (same padding, gap, 40px minimum height, `ui-md` heading) and add compounds for richer panel headers:

- `DataPanel.HeaderContent` — left block for a heading plus metadata; right-side actions are vertically centered against the whole block.
- `DataPanel.HeaderActions` — right-aligned action slot (replaces hand-rolled `ButtonsGroup className="ml-auto …"`).
- `DataPanel.Metadata` / `DataPanel.Meta` — a row of breadcrumb-style pills under the heading, with optional icon, tooltip, and link rendering via `as`.

```tsx
<DataPanel.Header>
  <DataPanel.HeaderContent>
    <DataPanel.Heading>Trace</DataPanel.Heading>
    <DataPanel.Metadata>
      <DataPanel.Meta as={Link} href="/agents/weather-agent" icon={<AgentIcon />} tooltip="Agent">
        weather-agent
      </DataPanel.Meta>
      <DataPanel.Meta icon={<TimerIcon />} tooltip="Duration 1.2s">1.2s</DataPanel.Meta>
    </DataPanel.Metadata>
  </DataPanel.HeaderContent>
  <DataPanel.HeaderActions>
    <DataPanel.CloseButton onClick={onClose} />
  </DataPanel.HeaderActions>
</DataPanel.Header>
```

`TraceSummaryDescription` and `SpanSummaryDescription` now render on these primitives.
