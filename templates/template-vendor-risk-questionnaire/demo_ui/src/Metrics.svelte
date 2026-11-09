<script lang="ts">
  import type { Metrics } from './api';
  let { metrics }: { metrics: Metrics } = $props();
  const display = (value: unknown) => value === null || value === undefined ? '—' : typeof value === 'number' ? new Intl.NumberFormat('en-US', { maximumFractionDigits: 6 }).format(value) : String(value);
  const groups = ['firstRouting', 'corrections', 'evidenceCoverage', 'timing', 'usage', 'failures'] as const;
</script>
<div class="dashboard">
<div class="metrics">
  {#each ['state', 'quality', 'totalQuestions', 'supportedAnswerRate', 'exports'] as key}
    <div class="metric"><span>{key}</span><strong>{display(metrics[key as keyof Metrics])}</strong></div>
  {/each}
</div>
<div class="metric-groups">
{#each groups as group}
  <details class="panel" name="metric-group"><summary>{group}</summary><dl>
    {#each Object.entries(metrics[group]) as [key, value]}
      {#if value === null || typeof value !== 'object'}<div><dt>{key}</dt><dd>{display(value)}</dd></div>
      {:else}<div><dt>{key}</dt><dd><pre>{JSON.stringify(value, null, 2)}</pre></dd></div>{/if}
    {/each}
  </dl></details>
{/each}
</div>
<details class="panel" name="metric-group"><summary>gapsByDomain</summary><div class="table-scroll"><table><thead><tr><th>domain</th><th>unknown</th><th>withheld</th><th>error</th></tr></thead><tbody>
  {#each Object.entries(metrics.gapsByDomain) as [domain, value]}<tr><td>{domain}</td><td>{value.unknown}</td><td>{value.withheld}</td><td>{value.error}</td></tr>{/each}
</tbody></table></div></details>
</div>

<style>
  .metric-groups { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; align-items: start; margin-top: 16px; }
  .dashboard .panel { padding: 16px; margin: 0; min-width: 0; }
  .dashboard > .panel { margin-top: 12px; }
  summary { font-size: 14px; }
  dl { margin-bottom: 0; font-size: 13px; }
  dl > div { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 12px; }
  @media (max-width: 600px) { .metric-groups { grid-template-columns: 1fr; } }
</style>
