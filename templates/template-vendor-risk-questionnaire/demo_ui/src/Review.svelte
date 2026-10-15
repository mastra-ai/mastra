<script lang="ts">
  import { Dialog } from 'bits-ui';
  import { untrack } from 'svelte';
  import type { Detail, ReviewDecision } from './api';
  import { canEditAnswer, canReleaseDraft, citationLocation, reasonMessages, statusLabels } from './review-presentation';
  let { detail, busy, submit }: { detail: Detail; busy: boolean; submit: (body: ReviewDecision) => Promise<void> } = $props();
  // The parent keys this form by revision; polling must preserve unsaved choices.
  const review = untrack(() => detail.review!);
  const reasons = { release: 'Supported by approved evidence.', unknown: 'No releasable supported answer is available.', withheld: 'Evidence is withheld.' };
  let choices = $state(review.questions.map(q => {
    const saved = detail.dispositions.find(d => d.questionId === q.id);
    const result = review.results.find(r => r.questionId === q.id)!;
    const draft = result.draft;
    const selected = saved?.correction ? 'correct' : saved?.disposition ?? '';
    const selection = (selected === 'correct' && !canEditAnswer(result, detail.documents)) ||
      (selected === 'release' && !canReleaseDraft(result, detail.documents)) ? '' : selected;
    return { questionId: q.id, selection,
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
      {@const allowsEditing = editable && canEditAnswer(result, detail.documents)}
      <article class="question review-card" aria-labelledby={`question-${q.id}`}>
        <header class="review-question">
          <div class="row"><span class="muted">Question {i + 1} of {review.questions.length} · {q.id}</span><span class="review-badge">{statusLabels[result.status]}</span></div>
          <h3 id={`question-${q.id}`}>{q.originalText}</h3>
          {#if q.instructions}<p class="muted">{q.instructions}</p>{/if}
        </header>
        {#if result.reasons.length}
          <aside class="review-alerts" aria-label={`Review notes for ${q.id}`}>
            <h4>Before you share</h4>
            <ul>{#each result.reasons as reason}
              <li><p>{reasonMessages[reason]}</p><code class="reason-code">{reason}</code></li>
            {/each}</ul>
          </aside>
        {/if}
        <div class="review-body">
          <section class="review-answer" aria-label={`Answer for ${q.id}`}>
            {#if result.draft && result.draft.value !== 'unknown'}
              <div class="row"><label for={`text-${q.id}`}>Answer</label><span class="review-badge">{result.draft.responseOption ?? result.draft.value.replaceAll('_', ' ')}</span></div>
              <textarea id={`text-${q.id}`} bind:value={choices[i].text}
                readonly={!allowsEditing || ['unknown', 'withheld'].includes(choices[i].selection)}
                oninput={() => { choices[i].selection = 'correct'; choices[i].safeReason = ''; }}
                maxlength="1000" required={choices[i].selection === 'correct'} rows="6"
                aria-describedby={`answer-help-${q.id}`}></textarea>
              <p id={`answer-help-${q.id}`} class="muted">
                {#if ['unknown', 'withheld'].includes(choices[i].selection)}This draft will not be included in the export.
                {:else if allowsEditing}Edit here if needed. Changes select “Release edited answer” and must pass validation.
                {:else if !editable}This is the reviewed answer.
                {:else}Draft for reference. This answer cannot be edited or released here.{/if}
              </p>
              {#if result.draft.limitations.length}
                <h4>Limitations</h4><ul class="limitations">{#each result.draft.limitations as limitation}<li>{limitation}</li>{/each}</ul>
              {/if}
            {:else}
              <h4>Answer</h4><p class="muted">No supported draft is available. Mark this answer as unknown or withhold it.</p>
            {/if}
            {#if editable}
              <label for={`disposition-${q.id}`}>Your decision</label>
              <select id={`disposition-${q.id}`} bind:value={choices[i].selection}
                onchange={() => { choices[i].safeReason = ''; if (choices[i].selection === 'release') choices[i].text = result.draft?.text ?? ''; }} required>
                <option value="" disabled>Choose what to share…</option>
                {#if canReleaseDraft(result, detail.documents)}<option value="release">Release original draft</option>{/if}
                {#if canEditAnswer(result, detail.documents)}<option value="correct">Release edited answer</option>{/if}
                <option value="unknown">Mark as unknown</option><option value="withheld">Withhold answer</option>
              </select>
              {#if released}
                {#each detail.documents.filter(d => d.disclosure === 'review_required' && result.draft?.citations.some(c => c.documentId === d.id)) as doc}
                  <label class="check disclosure-check"><input type="checkbox" bind:group={choices[i].releaseDocumentIds} value={doc.id} required />I authorize sharing evidence from {doc.label}.</label>
                {/each}
              {/if}
            {/if}
          </section>
          <section class="review-evidence" aria-label={`Evidence for ${q.id}`}>
            <h4>Cited evidence <span class="muted">({result.draft?.citations.length ?? 0})</span></h4>
            {#if result.reasons.includes('INVALID_ATTRIBUTION')}<p class="muted">These quotations could not be verified at the cited locations.</p>{/if}
            {#each result.draft?.citations ?? [] as citation}
              {@const doc = detail.documents.find(d => d.id === citation.documentId)}
              <div class="evidence-item">
                <strong>{doc?.label ?? citation.documentId}</strong>
                <p class="muted">{citation.version} · {citationLocation(citation.locator)}</p>
                <blockquote>{citation.supportingExcerpt}</blockquote>
                <span class="muted">{doc?.disclosure === 'review_required' ? 'Permission required to share' : doc?.disclosure === 'restricted' ? 'Restricted · cannot be shared' : doc?.disclosure === 'shareable' ? 'Approved for sharing' : 'Sharing policy unavailable'}</span>
              </div>
            {:else}<p class="muted">No evidence cited.</p>{/each}
          </section>
        </div>
      </article>
    {/each}
    {#if editable}
      <div class="review-submit"><p class="muted">{choices.filter(c => c.selection).length} of {choices.length} decisions made. Review validates your choices before approval.</p><button type="submit" disabled={!choices.every(c => c.selection)}>{busy ? 'Validating…' : 'Review'}</button></div>
    {/if}
  </fieldset>
</form>
{#if review.projection}
  <section class="panel">
    <h3>Validated answer set</h3>
    <p class="muted">Check the answers below before approving the export.</p>
    {#if dirty}<p class="notice">Your choices have changed. Select Review again to update this preview before approval.</p>{/if}
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
