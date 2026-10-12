<script lang="ts">
  import { Dialog } from 'bits-ui';
  import { untrack } from 'svelte';
  import type { Detail, ReviewDecision } from './api';
  let { detail, busy, submit }: { detail: Detail; busy: boolean; submit: (body: ReviewDecision) => Promise<void> } = $props();
  // The parent keys this form by revision; polling must preserve unsaved choices.
  const review = untrack(() => detail.review!);
  const reasons = { release: 'Supported by approved evidence.', unknown: 'No releasable supported answer is available.', withheld: 'Evidence is withheld.' };
  let choices = $state(review.questions.map(q => {
    const saved = detail.dispositions.find(d => d.questionId === q.id);
    const draft = review.results.find(r => r.questionId === q.id)?.draft;
    return { questionId: q.id, selection: saved?.correction ? 'correct' : saved?.disposition ?? '',
      text: saved?.correction?.text ?? draft?.text ?? '',
      releaseDocumentIds: [...(saved?.releaseDocumentIds ?? [])], safeReason: saved?.safeReason ?? '' };
  }));
  let dirty = $state(false), confirm = $state(false);
  const editable = review.state === 'awaiting_review';
  function decision(finalApproval: boolean): ReviewDecision {
    return { decisionId: crypto.randomUUID().replace(/[0-9]/g, digit => String.fromCharCode(103 + Number(digit))), runId: review.runId, organizationId: review.organizationId,
      expectedRevision: review.revision, expectedDigest: review.digest, policyDigest: review.policyDigest, finalApproval,
      dispositions: choices.map(choice => {
        const draft = review.results.find(r => r.questionId === choice.questionId)?.draft;
        const disposition = (choice.selection === 'correct' ? 'release' : choice.selection) as 'release' | 'unknown' | 'withheld';
        return { questionId: choice.questionId, disposition, safeReason: choice.safeReason || reasons[disposition],
          releaseDocumentIds: disposition === 'release' ? choice.releaseDocumentIds : [],
          ...(choice.selection === 'correct' && draft ? { correction: { ...draft, text: choice.text,
            claims: draft.claims.map((claim, i) => i === 0 ? { ...claim, text: choice.text } : claim) } } : {}) };
      }) };
  }
</script>

<form onsubmit={event => { event.preventDefault(); void submit(decision(false)); }} oninput={() => { dirty = true; }} onchange={() => { dirty = true; }}>
  <fieldset disabled={busy || !editable}>
    {#each review.questions as q, i}
      {@const result = review.results[i]}
      {@const released = ['release', 'correct'].includes(choices[i].selection)}
      <article class="question">
        <div class="row"><strong>{q.id}</strong><span class="status">{result.status}</span></div>
        <h3>{q.originalText}</h3>
        {#if q.instructions}<p class="muted">{q.instructions}</p>{/if}
        {#if result.reasons.length}<p class="muted">{result.reasons.join(' · ')}</p>{/if}
        {#if result.draft}
          <p>{result.draft.value}{result.draft.responseOption ? ` · ${result.draft.responseOption}` : ''}</p>
          <p class="response">{result.draft.text}</p>
          {#each result.draft.limitations as limitation}<p class="muted">{limitation}</p>{/each}
          {#if result.draft.citations.length}
            <details><summary>Citations</summary>
              {#each result.draft.citations as citation}
                <p>{detail.documents.find(d => d.id === citation.documentId)?.label ?? citation.documentId} · {citation.version}</p>
                <p class="muted">{JSON.stringify(citation.locator)}</p><blockquote>{citation.supportingExcerpt}</blockquote>
              {/each}
            </details>
          {/if}
        {/if}
        {#if editable}
          <label for={`disposition-${q.id}`}>Disposition</label>
          <select id={`disposition-${q.id}`} bind:value={choices[i].selection} onchange={() => { choices[i].safeReason = ''; }} required>
            <option value="" disabled>—</option>
            {#if result.draft && result.draft.value !== 'unknown'}<option value="release">release</option><option value="correct">correct</option>{/if}
            <option value="unknown">unknown</option><option value="withheld">withheld</option>
          </select>
          {#if choices[i].selection === 'correct'}
            <label for={`text-${q.id}`}>Corrected supported response text</label>
            <textarea id={`text-${q.id}`} bind:value={choices[i].text} maxlength="1000" required rows="4"></textarea>
          {/if}
          {#if released}
            {#each detail.documents.filter(d => d.disclosure === 'review_required' && result.draft?.citations.some(c => c.documentId === d.id)) as doc}
              <label class="check"><input type="checkbox" bind:group={choices[i].releaseDocumentIds} value={doc.id} />RELEASE · {doc.label}</label>
            {/each}
          {/if}
        {/if}
      </article>
    {/each}
    {#if editable}<button type="submit" disabled={!choices.every(c => c.selection)}>Review</button>{/if}
  </fieldset>
</form>
{#if review.projection}
  <section class="panel">
    <h3>Review</h3>
    {#each review.projection.answers as answer}
      <div class="question"><strong>{answer.questionId}</strong><p>{answer.question}</p><p>{answer.value} · {answer.disposition}</p><p class="response">{answer.text}</p><p class="muted">{answer.safeReason}</p>
        {#each answer.limitations as limitation}<p>{limitation}</p>{/each}
        {#each review.projection.evidence.filter(e => answer.citationIds.includes(e.id)) as citation}<p class="muted">{citation.label} · {citation.version} · {citation.locator}</p>{/each}
      </div>
    {/each}
    {#if editable}
      <Dialog.Root bind:open={confirm}>
        <Dialog.Trigger disabled={dirty || busy}>APPROVE</Dialog.Trigger>
        <Dialog.Portal><Dialog.Overlay class="overlay" /><Dialog.Content class="dialog">
          <Dialog.Title>Approve this complete displayed set?</Dialog.Title>
          <Dialog.Description>{detail.name} · {review.projection.quality} · {review.projection.supported}/{review.projection.total}</Dialog.Description>
          <div class="actions"><Dialog.Close>Cancel</Dialog.Close><button disabled={busy} onclick={async () => { await submit(decision(true)); confirm = false; }}>APPROVE</button></div>
        </Dialog.Content></Dialog.Portal>
      </Dialog.Root>
    {/if}
  </section>
{/if}
