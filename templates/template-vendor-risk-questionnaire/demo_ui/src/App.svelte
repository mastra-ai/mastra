<script lang="ts">
  import { onMount } from 'svelte';
  import { Tabs, Dialog } from 'bits-ui';
  import { json, request, download, setToken, errorMessage } from './api';
  import type { Questionnaire, Detail, Metrics as DomainMetrics, ReviewDecision } from './api';
  import Review from './Review.svelte';
  import Metrics from './Metrics.svelte';
  let tab = $state('upload'), rows = $state<Questionnaire[]>([]), selected = $state('');
  let detail = $state<Detail | null>(null), metrics = $state<DomainMetrics | null>(null);
  let pollError = $state('');
  let error = $state(''), busy = $state(false), loading = $state(true), login = $state(false), password = $state('');
  let files = $state<FileList>(), answer = $state('');
  let refreshing = false, refreshAgain = false;
  let removal = $state<Questionnaire | null>(null), confirmRemoval = $state(false);
  const isRunning = (state: string) => ['processing', 'awaiting_input', 'cancelling'].includes(state);
  const path = (id = selected) => `/vrq/questionnaires/${encodeURIComponent(id)}`;
  function fail(e: unknown, polling = false) {
    const message = e instanceof Error ? e.message : String(e);
    if (polling) pollError = message; else error = message;
    if (message === '401') { login = true; rows = []; detail = null; metrics = null; }
  }
  async function refresh() {
    if (login) return;
    if (refreshing) { refreshAgain = true; return; }
    refreshing = true;
    const id = selected;
    try {
      const nextRows = await json<Questionnaire[]>('/vrq/questionnaires');
      rows = nextRows;
      if (id !== selected) return;
      if (id && !rows.some(row => row.runId === id)) { selected = ''; detail = null; metrics = null; return; }
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
    } catch (e) { fail(e, true); } finally { loading = false; refreshing = false; if (refreshAgain) { refreshAgain = false; void refresh(); } }
  }
  async function action(work: () => Promise<unknown>) {
    if (busy) return;
    busy = true; error = '';
    try { await work(); } catch (e) { fail(e); } finally { busy = false; await refresh(); }
  }
  function select(id: string) { selected = id; detail = null; metrics = null; error = ''; void refresh(); }
  async function upload() {
    const file = files?.[0];
    if (!file) return;
    await action(async () => {
      const body = new FormData(); body.set('file', file);
      const response = await request('/vrq/questionnaires', { method: 'POST', body });
      const result = await response.json().catch(() => { throw new Error('Unexpected upload response.'); });
      if (typeof result?.runId !== 'string' || !result.runId.trim()) throw new Error('Unexpected upload response.');
      selected = result.runId; detail = null; tab = 'questionnaires'; files = undefined;
    });
  }
  async function remove() {
    const target = removal;
    if (!target) return;
    await action(async () => {
      await request(path(target.runId), { method: 'DELETE' });
      rows = rows.filter(row => row.runId !== target.runId);
      if (selected === target.runId) { selected = ''; detail = null; metrics = null; answer = ''; }
      confirmRemoval = false; removal = null;
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
        <div class="table-scroll"><table><thead><tr><th>Questionnaire</th><th>Status</th><th>Download</th><th>Actions</th></tr></thead><tbody>
          {#each rows as row}<tr class:selected={selected === row.runId}><td><button class="link" onclick={() => select(row.runId)} disabled={busy}>{row.name}</button></td><td>{row.state}</td><td>{#if row.download}<a href={row.download} onclick={event => { event.preventDefault(); void action(() => download(row.download!)); }}>Download</a>{:else}—{/if}</td><td><button disabled={busy || isRunning(row.state)} aria-label={`Remove ${row.name}`} title={isRunning(row.state) ? 'Cancel the execution before removing this questionnaire.' : 'Remove questionnaire'} onclick={() => { removal = row; confirmRemoval = true; }}>Remove</button></td></tr>
          {:else}<tr><td colspan="4">{loading ? '…' : '—'}</td></tr>{/each}
        </tbody></table></div>
        {#if detail}
          <section class="detail" aria-busy={isRunning(detail.state)}>
            <div class="row"><h2>{detail.name}</h2><span class="status">{detail.state}</span></div>
            {#if isRunning(detail.state)}
              <button disabled={busy || detail.state === 'cancelling'} onclick={() => void action(() => json(`${path()}/cancel`, {}))}>{detail.state === 'cancelling' ? 'Cancelling…' : 'Cancel execution'}</button>
            {/if}
            {#if detail.error}<p role="alert" class="notice">{errorMessage(detail.error)}</p>{/if}
            {#if detail.prompt && detail.state === 'awaiting_input'}
              <form class="panel" onsubmit={event => { event.preventDefault(); void action(() => json(`${path()}/input`, { id: detail!.prompt!.id, answer })); }}>
                <p class="response">{detail.prompt.context}</p><label for="answer">{detail.prompt.text}</label><input id="answer" bind:value={answer} disabled={busy} /><button disabled={busy}>Submit</button>
              </form>
            {/if}
            {#if detail.review}
              {#key `${detail.runId}:${detail.review.revision}:${detail.review.digest}:${detail.review.state}`}<Review {detail} busy={busy || isRunning(detail.state) || detail.state === 'cancelled'} {submit} />{/key}
            {/if}
            {#if ['interrupted', 'approved', 'exporting'].includes(detail.state) || (detail.state === 'failed' && !detail.metrics)}
              <button disabled={busy} onclick={() => void action(() => json(`${path()}/resume`, {}))}>Resume</button>
            {/if}
          </section>
        {/if}
      </Tabs.Content>
      <Tabs.Content value="metrics">
        <label for="metrics-run">Questionnaire</label><select id="metrics-run" disabled={busy} value={selected} onchange={event => select(event.currentTarget.value)}><option value="">—</option>{#each rows.filter(r => r.metrics) as row}<option value={row.runId}>{row.name} · {row.runId}</option>{/each}</select>
        {#if metrics}<Metrics {metrics} />{/if}
      </Tabs.Content>
    </Tabs.Root>
  {/if}
  <Dialog.Root bind:open={confirmRemoval}>
    <Dialog.Portal><Dialog.Overlay class="overlay" /><Dialog.Content class="dialog">
      <Dialog.Title>Remove questionnaire?</Dialog.Title>
      <Dialog.Description>Remove {removal?.name} from the questionnaire list? It will no longer be accessible from this UI.</Dialog.Description>
      <div class="actions"><Dialog.Close disabled={busy}>Keep questionnaire</Dialog.Close><button disabled={busy} onclick={() => void remove()}>{busy ? 'Removing…' : 'Remove'}</button></div>
    </Dialog.Content></Dialog.Portal>
  </Dialog.Root>
</main>
