<script lang="ts">
  import { onMount } from 'svelte';
  import { Tabs } from 'bits-ui';
  import { json, request, download, setToken } from './api';
  import type { Questionnaire, Detail, Metrics as DomainMetrics, ReviewDecision } from './api';
  import Review from './Review.svelte';
  import Metrics from './Metrics.svelte';
  let tab = $state('upload'), rows = $state<Questionnaire[]>([]), selected = $state('');
  let detail = $state<Detail | null>(null), metrics = $state<DomainMetrics | null>(null);
  let pollError = $state('');
  let error = $state(''), busy = $state(false), loading = $state(true), login = $state(false), password = $state('');
  let files = $state<FileList>(), answer = $state('');
  let refreshing = false;
  const path = (id = selected) => `/vrq/questionnaires/${encodeURIComponent(id)}`;
  function fail(e: unknown, polling = false) {
    const message = e instanceof Error ? e.message : String(e);
    if (polling) pollError = message; else error = message;
    if (message === '401') { login = true; rows = []; detail = null; metrics = null; }
  }
  async function refresh() {
    if (refreshing || login) return;
    refreshing = true;
    const id = selected;
    try {
      rows = await json<Questionnaire[]>('/vrq/questionnaires');
      pollError = '';
      if (id) {
        const next = await json<Detail>(path(id));
        if (id !== selected) return;
        if (next.prompt?.id !== detail?.prompt?.id) answer = '';
        detail = next;
        if (tab === 'metrics' && next.metrics) {
          const result = await json<DomainMetrics>(`${path(id)}/metrics`);
          if (id === selected) metrics = result;
        } else metrics = null;
      }
    } catch (e) { fail(e, true); } finally { loading = false; refreshing = false; }
  }
  async function action(work: () => Promise<unknown>) {
    busy = true; error = '';
    try { await work(); } catch (e) { fail(e); } finally { busy = false; await refresh(); }
  }
  function select(id: string) { selected = id; detail = null; metrics = null; error = ''; void refresh(); }
  async function upload() {
    const file = files?.[0];
    if (!file) return;
    await action(async () => {
      const body = new FormData(); body.set('file', file);
      const result = await (await request('/vrq/questionnaires', { method: 'POST', body })).json();
      selected = result.runId; detail = null; tab = 'questionnaires'; files = undefined;
    });
  }
  const submit = (body: ReviewDecision) => action(() => json(`${path()}/review`, body));
  onMount(() => {
    void refresh();
    const timer = setInterval(() => { if (!document.hidden && !busy) void refresh(); }, 3000);
    return () => clearInterval(timer);
  });
</script>

<main>
  <header><h1>Questionnaires</h1></header>
  {#if error || pollError}<p role="alert" class="notice">{error || pollError}</p>{/if}
  {#if login}
    <form class="panel narrow" onsubmit={event => { event.preventDefault(); setToken(password); password = ''; login = false; error = ''; void refresh(); }}>
      <label for="token">Token</label><input id="token" type="password" bind:value={password} autocomplete="off" required /><button>Sign in</button>
    </form>
  {:else}
    <Tabs.Root bind:value={tab} onValueChange={() => { void refresh(); }}>
      <Tabs.List aria-label="Questionnaires" class="tabs"><Tabs.Trigger value="upload">Upload</Tabs.Trigger><Tabs.Trigger value="questionnaires">Questionnaires</Tabs.Trigger><Tabs.Trigger value="metrics">Review metrics</Tabs.Trigger></Tabs.List>
      <Tabs.Content value="upload">
        <form class="panel narrow" onsubmit={event => { event.preventDefault(); void upload(); }}>
          <label for="file">Questionnaire</label><input id="file" type="file" accept=".xlsx,.docx" bind:files required disabled={busy} /><p class="muted">XLSX · DOCX</p><button disabled={busy || !files?.length}>{busy ? '…' : 'Submit'}</button>
        </form>
      </Tabs.Content>
      <Tabs.Content value="questionnaires">
        <div class="table-scroll"><table><thead><tr><th>Questionnaire</th><th>Status</th><th>Download</th></tr></thead><tbody>
          {#each rows as row}<tr class:selected={selected === row.runId}><td><button class="link" onclick={() => select(row.runId)}>{row.name}</button></td><td>{row.state}</td><td>{#if row.download}<a href={row.download} onclick={event => { event.preventDefault(); void action(() => download(row.download!)); }}>Download</a>{:else}—{/if}</td></tr>
          {:else}<tr><td colspan="3">{loading ? '…' : '—'}</td></tr>{/each}
        </tbody></table></div>
        {#if detail}
          <section class="detail" aria-busy={detail.state === 'processing'}>
            <div class="row"><h2>{detail.name}</h2><span class="status">{detail.state}</span></div>
            {#if detail.error}<p role="alert" class="notice">{detail.error}</p>{/if}
            {#if detail.prompt}
              <form class="panel" onsubmit={event => { event.preventDefault(); void action(() => json(`${path()}/input`, { id: detail!.prompt!.id, answer })); }}>
                <p class="response">{detail.prompt.context}</p><label for="answer">{detail.prompt.text}</label><input id="answer" bind:value={answer} disabled={busy} /><button disabled={busy}>Submit</button>
              </form>
            {/if}
            {#if detail.review}
              {#key `${detail.runId}:${detail.review.revision}:${detail.review.digest}:${detail.review.state}`}<Review {detail} busy={busy || detail.state === 'processing'} {submit} />{/key}
            {/if}
            {#if ['interrupted', 'approved', 'exporting'].includes(detail.state) || (detail.state === 'failed' && !detail.metrics)}
              <button disabled={busy} onclick={() => void action(() => json(`${path()}/resume`, {}))}>Resume</button>
            {/if}
          </section>
        {/if}
      </Tabs.Content>
      <Tabs.Content value="metrics">
        <label for="metrics-run">Questionnaire</label><select id="metrics-run" value={selected} onchange={event => select(event.currentTarget.value)}><option value="">—</option>{#each rows.filter(r => r.metrics) as row}<option value={row.runId}>{row.name} · {row.runId}</option>{/each}</select>
        {#if metrics}<Metrics {metrics} />{/if}
      </Tabs.Content>
    </Tabs.Root>
  {/if}
</main>
