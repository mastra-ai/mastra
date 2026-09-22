// Kept as a single external, CSP-safe asset. The multiline source makes the live
// projection share the SSR semantics instead of maintaining several fragments.
export const dashboardJs = `(() => {
  const d = document;
  const root = d.querySelector('[data-incident-id]');
  const live = d.querySelector('[data-live-status]');
  if (!root || !window.EventSource) return;

  const id = root.dataset.incidentId;
  const csrf = root.dataset.csrfToken;
  // This is a role capability, deliberately independent of the SSR plan state.
  const canDecide = root.dataset.canDecide === 'true';
  const canReview = root.dataset.canReview === 'true';
  const query = (selector) => d.querySelector(selector);
  const say = (message) => { if (live) live.textContent = message; };
  const sequence = (cursor) => Number(String(cursor || '').split(':').at(-1));
  const connected = (node) => Boolean(node) && node.isConnected !== false;
  const append = (parent, tag, text, data) => {
    const node = d.createElement(tag);
    if (data) Object.assign(node.dataset, data);
    node.textContent = text;
    parent.append(node);
    return node;
  };
  const words = (value) => String(value || '')
    .replace(/[._-]+/g, ' ')
    .replace(/\\b\\w/g, (letter) => letter.toUpperCase());
  const actionLabels = {
    require_reauthentication: 'Require reauthentication',
    revoke_session: 'Revoke suspicious session',
    revert_role_change: 'Revert privilege change',
    disable_user: 'Disable user access',
  };
  const eventLabels = {
    'incident.received': 'Alert received',
    'workflow.investigation_started': 'Investigation started',
    'evidence.persisted': 'Evidence collected',
    'evidence.correlated': 'Evidence correlated',
    'runbook.retrieved': 'Response runbook selected',
    'triage.classification.completed': 'Risk classified',
    'triage.summary.completed': 'Incident summary prepared',
    'triage.proposal.completed': 'Containment actions proposed',
    'triage.manual_review.decided': 'Manual review recorded',
    'approval.requested': 'Review requested',
    'approval.decided': 'Decision recorded',
    'containment.started': 'Containment started',
    'containment.completed': 'Containment completed',
    'incident.status_changed': 'Incident status updated',
  };
  const actionLabel = (value) => actionLabels[value] || words(value);
  const eventLabel = (value) => eventLabels[value] || words(value);
  const formatDate = (value) => {
    const parsed = Date.parse(value);
    if (!Number.isFinite(parsed)) return value;
    return new Intl.DateTimeFormat('en', {
      dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC',
    }).format(parsed) + ' UTC';
  };
  const shortRef = (value) => String(value).length > 22
    ? String(value).slice(0, 10) + '…' + String(value).slice(-6)
    : String(value);
  const decisionEligible = (detail) =>
    canDecide &&
    detail.plan &&
    !detail.approval?.decision &&
    detail.incident.status === 'awaiting_approval' &&
    Number.isFinite(Date.parse(detail.plan.expiresAt)) &&
    Date.parse(detail.plan.expiresAt) > Date.now();
  const manualReviewEligible = (detail) =>
    canReview && detail.manualReview &&
    (!detail.manualReview.decision ||
      detail.manualReview.decision.decision === 'accepted') &&
    detail.incident.status === 'investigating' && detail.incident.workflowRunId;
  const completingManualReview = (detail) =>
    detail.manualReview?.decision?.decision === 'accepted';

  let confirmed = sequence(root.dataset.timelineCursor);
  let received = confirmed;
  let refreshing = false;
  let queued = false;
  let queuedEpoch = 0;
  let epoch = 0;
  let pendingResyncEpoch = 0;
  let retryTimer = null;
  let retryEpoch = 0;
  let retryAttempt = 0;
  let source;
  let dialog = null;
  let form = null;
  let opener = null;

  const fallbackFocus = () =>
    query('[data-triage-projection]')?.querySelector?.('h2') ||
    query('[data-incident-summary]') ||
    root;
  const restoreFocus = () => {
    if (!opener) return;
    const target = connected(opener) ? opener : fallbackFocus();
    if (connected(target)) target.focus?.();
    opener = null;
  };
  const closeDecision = () => {
    const current = dialog || d.getElementById('decision-dialog') ||
      d.getElementById('manual-review-dialog');
    if (current?.open) current.close();
    restoreFocus();
    dialog = null;
    form = null;
  };

  const decisionError = (message) => {
    const error = query('[data-decision-error]');
    if (error) error.textContent = message;
    say(message);
  };
  const setDecisionBusy = (target, busy) => {
    if (!target) return;
    if (busy) target.setAttribute('aria-busy', 'true');
    else target.removeAttribute?.('aria-busy');
    for (const button of target.querySelectorAll('button')) button.disabled = busy;
  };

  const bindDecision = () => {
    dialog = d.getElementById('decision-dialog') ||
      d.getElementById('manual-review-dialog');
    form = query('[data-decision-form]') || query('[data-manual-review-form]');
    for (const button of d.querySelectorAll('[data-open-decision],[data-open-manual-review]')) {
      button.addEventListener('click', () => {
        opener = button;
        dialog?.showModal();
        form?.querySelector('[name="decision"]')?.focus();
      });
    }
    for (const button of d.querySelectorAll('[data-close-dialog]'))
      button.addEventListener('click', closeDecision);
    dialog?.addEventListener('cancel', restoreFocus);
    dialog?.addEventListener('close', restoreFocus);
    dialog?.addEventListener('keydown', (event) => {
      if (event.key !== 'Tab') return;
      const controls = [...dialog.querySelectorAll('button,select,textarea,input')]
        .filter((control) => !control.disabled && control.type !== 'hidden');
      const first = controls[0];
      const last = controls.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && d.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && d.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });
    form?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const submittedForm = form;
      if (!submittedForm) return;
      const values = new FormData(submittedForm);
      const decision = String(values.get('decision'));
      const reason = String(values.get('reason') || '').trim();
      const isManualReview = submittedForm.dataset.manualReviewForm !== undefined;
      decisionError('');
      if ((decision === 'rejected' || decision === 'dismissed' || decision === 'resolved') && !reason) {
        decisionError(isManualReview
          ? decision === 'resolved'
            ? 'Summarize how this incident was resolved before closing it.'
            : 'Explain why this incident should be dismissed.'
          : 'Explain why these actions should be rejected.');
        submittedForm.querySelector('[name="reason"]')?.focus();
        return;
      }
      setDecisionBusy(submittedForm, true);
      try {
        const response = await fetch(
          '/api/incidents/' + encodeURIComponent(id) +
            (isManualReview ? '/manual-review' : '/approvals'),
          {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
              'X-CSRF-Token': String(values.get('csrfToken')),
            },
            body: JSON.stringify(isManualReview
              ? {
                  decision,
                  reason: reason || undefined,
                  workflowRunId: values.get('workflowRunId'),
                }
              : {
                  decision,
                  reason: reason || undefined,
                  planId: values.get('planId'),
                  planHashVersion: Number(values.get('planHashVersion')),
                  planHash: values.get('planHash'),
                }),
          },
        );
        if (!response.ok) {
          const message = response.status === 409
            ? isManualReview
              ? 'This manual review is no longer current or was already recorded. Refresh the incident.'
              : 'This plan is no longer current or its review window expired. No decision was recorded. Start a new investigation to generate a fresh plan.'
            : response.status === 401
              ? 'Your session changed before the decision was recorded. Reload the page and sign in again if requested.'
              : response.status === 403
                ? 'Your current role cannot decide this plan.'
                : response.status === 429
                  ? 'Too many decision attempts. Wait a moment and try again.'
                  : response.status === 422
                    ? 'The decision is incomplete or invalid. Review the fields and try again.'
                    : response.status === 503
                      ? 'The decision service is temporarily unavailable. No decision was recorded; please retry.'
                      : 'The decision was not recorded. Refresh the page and try again.';
          decisionError(message);
          if (response.status === 409) void refresh();
          return;
        }
        setDecisionBusy(submittedForm, false);
        closeDecision();
        say(isManualReview
          ? decision === 'resolved'
            ? 'Manual review completed. Refreshing the incident status.'
            : 'Manual review recorded. Refreshing the incident status.'
          : 'Decision recorded. Refreshing the incident status.');
        const applied = await refresh();
        if (!applied)
          say('Decision recorded, but the latest incident status could not be loaded. Reload the page to confirm execution.');
      } catch {
        decisionError('Decision could not be sent. Check your connection and retry.');
      } finally {
        setDecisionBusy(submittedForm, false);
      }
    });
  };
  const bindDeviceAuthorization = () => {
    const deviceForm = query('[data-device-authorization-form]');
    if (!deviceForm || deviceForm.dataset.bound === 'true') return;
    deviceForm.dataset.bound = 'true';
    deviceForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const values = new FormData(deviceForm);
      const reason = String(values.get('reason') || '').trim();
      const error = query('[data-device-authorization-error]');
      if (!reason) {
        if (error) error.textContent = 'An audit reason is required.';
        return;
      }
      setDecisionBusy(deviceForm, true);
      try {
        const response = await fetch(
          '/api/incidents/' + encodeURIComponent(id) + '/device-authorization',
          {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
              'X-CSRF-Token': String(values.get('csrfToken')),
            },
            body: JSON.stringify({
              action: values.get('action'),
              reason,
            }),
          },
        );
        if (!response.ok) throw Error(String(response.status));
        const result = await response.json();
        const authorized = result.authorized === true;
        const action = deviceForm.querySelector('[name="action"]');
        const button = deviceForm.querySelector('[type="submit"]');
        const badge = deviceForm.closest('section')?.querySelector('.badge');
        if (action) action.value = authorized ? 'revoke' : 'authorize';
        if (button) button.textContent = authorized ? 'Revoke device' : 'Authorize device';
        if (badge) {
          badge.textContent = authorized ? 'Authorized' : 'Unknown device';
          badge.className = 'badge ' + (authorized ? 'status-completed' : 'status-pending');
        }
        const reasonField = deviceForm.querySelector('[name="reason"]');
        if (reasonField) reasonField.value = '';
        if (error) error.textContent = '';
        setDecisionBusy(deviceForm, false);
      } catch {
        if (error)
          error.textContent = 'The device authorization was not recorded. Refresh and retry.';
        setDecisionBusy(deviceForm, false);
      }
    });
  };

  const renderEvidence = (detail) => {
    const host = query('[data-evidence-projection]');
    if (!host) return;
    host.replaceChildren();
    const sectionHeading = append(host, 'div', '');
    sectionHeading.className = 'section-heading';
    const headingCopy = append(sectionHeading, 'div', '');
    append(headingCopy, 'p', 'Supporting signals').className = 'eyebrow';
    const heading = append(headingCopy, 'h2', 'Evidence coverage');
    heading.id = 'evidence-heading';
    append(sectionHeading, 'span', (detail.evidence || []).length + ' signals').className = 'count-chip';
    const grid = append(host, 'div', '');
    grid.className = 'evidence-grid';
    const grouped = new Map();
    for (const item of detail.evidence || []) {
      const group = grouped.get(item.source) || {
        source: item.source, providers: new Set(), count: 0, available: 0, confidence: 0,
      };
      group.providers.add(item.provider);
      group.count += 1;
      if (item.state !== 'missing') group.available += 1;
      group.confidence += Number(item.confidence || 0);
      grouped.set(item.source, group);
    }
    for (const group of grouped.values()) {
      const article = append(grid, 'article', '');
      article.className = 'evidence-card ' + (group.available ? 'is-available' : 'is-missing');
      append(article, 'div', group.available ? '✓' : '!').className = 'evidence-icon';
      const copy = append(article, 'div', '');
      append(copy, 'h3', words(group.source));
      append(copy, 'p', group.available
        ? group.available + ' of ' + group.count + ' signals available'
        : 'No signals available');
      append(copy, 'small', [...group.providers].map(words).join(', ') + ' · ' +
        Math.round(group.confidence / group.count * 100) + '% confidence');
    }
  };
  const renderTriage = (detail) => {
    const host = query('[data-triage-projection]');
    if (!host) return;
    host.replaceChildren();
    if (!detail.triage) {
      if (detail.manualReview) {
        const review = append(host, 'section', ''); review.className = 'card review-card';
        const heading = append(review, 'h2', 'Human assessment required'); heading.id = 'review-heading';
        append(review, 'p', 'The workflow could not produce an evidence-backed containment recommendation. Review the available signals before deciding how this incident should be handled.').className = 'lead';
        const reasons = append(review, 'ul', ''); reasons.className = 'review-reasons';
        for (const reason of detail.manualReview.reasonCodes || [])
          append(reasons, 'li', words(reason));
        return;
      }
      const waiting = append(host, 'section', ''); waiting.className = 'card';
      const heading = append(waiting, 'h2', 'Assessment in progress'); heading.id = 'plan-heading';
      append(waiting, 'p', 'The workflow is still gathering and correlating evidence.').className = 'muted';
      return;
    }
    const summary = append(host, 'section', ''); summary.className = 'card summary-card';
    const summaryHeading = append(summary, 'div', ''); summaryHeading.className = 'section-heading';
    const summaryCopy = append(summaryHeading, 'div', '');
    append(summaryCopy, 'p', 'Assessment').className = 'eyebrow';
    const whatHappened = append(summaryCopy, 'h2', 'What happened'); whatHappened.id = 'summary-heading';
    append(summaryHeading, 'span', detail.triage.runbook).className = 'runbook-chip';
    append(summary, 'p', detail.triage.summary, { triageSummary: '' }).className = 'lead';
    const findings = append(summary, 'div', ''); findings.className = 'finding-list';
    for (const fact of detail.triage.facts || []) {
      const row = append(findings, 'p', ''); row.className = 'finding finding-confirmed';
      append(row, 'span', '✓'); append(row, 'span', fact);
    }
    if ((detail.triage.hypotheses || []).length) {
      const hypotheses = append(summary, 'details', ''); hypotheses.className = 'hypotheses';
      append(hypotheses, 'summary', detail.triage.hypotheses.length + ' item' +
        (detail.triage.hypotheses.length === 1 ? '' : 's') + ' still need confirmation');
      for (const hypothesis of detail.triage.hypotheses) {
        const row = append(hypotheses, 'p', ''); row.className = 'finding finding-open';
        append(row, 'span', '?'); append(row, 'span', hypothesis);
      }
    }
    const plan = append(host, 'section', ''); plan.className = 'card';
    const planHeading = append(plan, 'div', ''); planHeading.className = 'section-heading';
    const planCopy = append(planHeading, 'div', '');
    append(planCopy, 'p', 'Recommended response').className = 'eyebrow';
    const heading = append(planCopy, 'h2', 'Containment actions'); heading.id = 'plan-heading';
    append(planHeading, 'span', detail.triage.actions.length + ' proposed').className = 'count-chip';
    const actionList = append(plan, 'div', ''); actionList.className = 'action-list';
    for (const [index, action] of detail.triage.actions.entries()) {
      const article = append(actionList, 'article', ''); article.className = 'action-card';
      append(article, 'div', String(index + 1)).className = 'action-number';
      const copy = append(article, 'div', ''); copy.className = 'action-content';
      append(copy, 'h3', actionLabel(action.type));
      append(copy, 'p', action.impact).className = 'action-impact';
      append(copy, 'p', 'Target ' + shortRef(action.targetRef)).className = 'target-line';
      const technical = append(copy, 'details', ''); technical.className = 'technical-details';
      append(technical, 'summary', 'Safety and verification details');
      const list = append(technical, 'dl', '');
      for (const [label, value] of [
        ['Preconditions', action.preconditions.join('; ')],
        ['Rollback', action.rollback], ['Verify', action.verification], ['Action ID', action.actionId],
      ]) {
        const row = append(list, 'div', ''); append(row, 'dt', label); append(row, 'dd', value);
      }
    }
    if (detail.plan) {
      const integrity = append(plan, 'details', '', { planBinding: '' });
      integrity.className = 'technical-details plan-binding';
      append(integrity, 'summary', 'Plan integrity details');
      append(integrity, 'p', 'Fingerprint v' + detail.plan.planHashVersion + ' · ' + detail.plan.planHash);
      append(integrity, 'p', 'Expires ' + formatDate(detail.plan.expiresAt));
    }
  };
  const renderDecisionPanel = (detail) => {
    const host = query('[data-decision-panel]');
    if (!host) {
      const triageHost = query('[data-triage-projection]');
      if (triageHost && (decisionEligible(detail) || manualReviewEligible(detail))) {
        const manual = manualReviewEligible(detail);
        const button = append(triageHost, 'button', manual
          ? completingManualReview(detail) ? 'Finish manual review' : 'Review incident'
          : 'Review proposed actions', manual ? { openManualReview: '' } : { openDecision: '' });
        button.type = 'button'; button.className = 'button button-primary';
      }
      return;
    }
    host.replaceChildren();
    append(host, 'p', 'Action required').className = 'eyebrow';
    const actionCount = detail.triage?.actions?.length || 0;
    const heading = append(host, 'h2', decisionEligible(detail)
      ? 'Review ' + actionCount + ' containment action' + (actionCount === 1 ? '' : 's')
      : manualReviewEligible(detail)
        ? completingManualReview(detail)
          ? 'Complete manual review'
          : 'Review the incident'
        : detail.manualReview?.decision
          ? 'Manual review recorded'
          : 'Decision status');
    heading.id = 'decision-panel-heading';
    append(host, 'p', decisionEligible(detail)
      ? 'Confirm that the proposed actions are safe and appropriately scoped before execution.'
      : manualReviewEligible(detail)
        ? completingManualReview(detail)
          ? 'Record the analyst resolution and close the incident. No containment action will run.'
          : 'Accept the incident for manual handling or dismiss it as a false positive. No containment action will run.'
        : detail.manualReview?.decision
          ? detail.manualReview.decision.decision === 'accepted'
            ? 'This incident was accepted for manual investigation.'
            : detail.manualReview.decision.decision === 'resolved'
              ? 'The manual investigation was completed and the incident was closed.'
              : 'This incident was dismissed and closed without containment.'
      : detail.approval?.decision
        ? 'This plan was ' + detail.approval.decision + '.'
        : 'There is no active decision available for this incident.');
    if (decisionEligible(detail)) {
      append(host, 'p', 'Decision window closes ' + formatDate(detail.plan.expiresAt)).className = 'plan-expiry';
      const button = append(host, 'button', 'Review proposed actions', { openDecision: '' });
      button.type = 'button'; button.className = 'button button-primary button-block';
    } else if (manualReviewEligible(detail)) {
      const button = append(host, 'button', completingManualReview(detail) ? 'Finish manual review' : 'Review incident', { openManualReview: '' });
      button.type = 'button'; button.className = 'button button-primary button-block';
    }
    append(host, 'p', 'Containment never runs without an explicit SOC manager decision.').className = 'decision-note';
  };
  const renderRunbook = (detail) => {
    const host = query('[data-runbook-projection]');
    if (!host) return;
    host.replaceChildren();
    if (!detail.runbook) return;
    const viewer = append(host, 'details', '', { runbookViewer: '' });
    viewer.className = 'card runbook-card';
    const summary = append(viewer, 'summary', '');
    const identity = append(summary, 'span', '');
    append(identity, 'span', 'Response policy').className = 'eyebrow';
    append(identity, 'strong', detail.runbook.runbookId + ' · v' + detail.runbook.version);
    append(summary, 'span', 'View runbook').className = 'button button-secondary';
    const header = append(viewer, 'div', ''); header.className = 'runbook-header';
    const copy = append(header, 'div', '');
    append(copy, 'h2', 'Runbook used for this incident');
    append(copy, 'p', 'This is the immutable version consulted by the workflow. The highlighted sections were returned by semantic retrieval.');
    const metadata = append(header, 'dl', '');
    for (const [label, value] of [
      ['Owner', words(detail.runbook.owner)], ['Source', detail.runbook.sourcePath],
    ]) {
      const row = append(metadata, 'div', ''); append(row, 'dt', label); append(row, 'dd', value);
    }
    const sections = append(viewer, 'div', ''); sections.className = 'runbook-sections';
    for (const section of detail.runbook.sections || []) {
      const item = append(sections, 'details', '');
      if (section.selected) item.className = 'is-relevant';
      const itemSummary = append(item, 'summary', '');
      append(itemSummary, 'span', section.title);
      if (section.selected) append(itemSummary, 'span', 'Used in retrieval').className = 'count-chip';
      append(item, 'pre', section.content);
    }
  };
  const renderOperational = (detail) => {
    const host = query('[data-operational-projection]');
    if (!host) return;
    host.replaceChildren();
    const sectionHeading = append(host, 'div', ''); sectionHeading.className = 'section-heading';
    const headingCopy = append(sectionHeading, 'div', '');
    append(headingCopy, 'p', 'Current state').className = 'eyebrow';
    const heading = append(headingCopy, 'h2', 'Decision and execution');
    heading.id = 'approval-heading';
    const outcome = detail.outcome || { status: 'pending', completedCount: 0, failedCount: 0 };
    const operational = detail.operationalState || {
      decision: detail.approval?.decision || 'not_requested',
      execution: outcome.status === 'pending' ? 'not_started' : outcome.status,
    };
    const actionCount = (detail.actions || []).length;
    const statusGrid = append(host, 'div', ''); statusGrid.className = 'status-grid';
    for (const [label, value, data] of [
      ['Decision', words(operational.decision), { approvalStatus: '' }],
      ['Execution', words(operational.execution), { outcomeStatus: '' }],
      ['Completed', actionCount ? outcome.completedCount + ' / ' + actionCount : '—', null],
      ['Failed', actionCount ? String(outcome.failedCount) : '—', null],
    ]) {
      const cell = append(statusGrid, 'div', ''); append(cell, 'span', label); append(cell, 'strong', value, data);
    }
    if (detail.approval?.reason)
      append(host, 'p', 'Reason: ' + detail.approval.reason).className = 'decision-reason';
    const actions = append(host, 'ul', '', { actions: '' }); actions.className = 'execution-list';
    for (const action of detail.actions || []) {
      const item = append(actions, 'li', '');
      append(item, 'span', actionLabel(action.type));
      const status = append(item, 'span', words(action.status)); status.className = 'badge status-' + action.status;
    }
  };
  const renderDecision = (detail) => {
    const host = query('[data-decision-host]');
    if (!host) return;
    // Restore focus before replacing the host: a live terminal/expiry update can
    // otherwise detach both the open dialog and its opener.
    if (!decisionEligible(detail) && !manualReviewEligible(detail)) closeDecision();
    host.replaceChildren();
    if (!decisionEligible(detail) && !manualReviewEligible(detail)) return;

    if (manualReviewEligible(detail)) {
      const box = d.createElement('dialog');
      box.id = 'manual-review-dialog';
      box.setAttribute('aria-labelledby', 'manual-review-heading');
      box.setAttribute('aria-describedby', 'manual-review-help decision-error');
      const dialogHeader = append(box, 'div', ''); dialogHeader.className = 'dialog-header';
      append(dialogHeader, 'p', 'Human triage').className = 'eyebrow';
      const completing = completingManualReview(detail);
      const title = append(dialogHeader, 'h2', completing ? 'Complete manual review' : 'Record manual review'); title.id = 'manual-review-heading';
      append(dialogHeader, 'p', completing
        ? 'Closing records the analyst resolution in the audit trail. It does not execute containment actions.'
        : 'This decision handles the incident record only. It does not approve or execute containment actions.');
      const nextForm = d.createElement('form');
      nextForm.className = 'decision-form'; nextForm.dataset.manualReviewForm = '';
      nextForm.dataset.incidentId = id;
      for (const [name, value] of [
        ['csrfToken', csrf], ['workflowRunId', detail.incident.workflowRunId],
      ]) {
        const input = d.createElement('input'); input.type = 'hidden'; input.name = name; input.value = value;
        nextForm.append(input);
      }
      const decisionLabel = append(nextForm, 'label', 'Decision'); decisionLabel.className = 'field';
      decisionLabel.htmlFor = 'manual-review-select';
      const select = d.createElement('select'); select.id = 'manual-review-select'; select.name = 'decision';
      for (const [value, label] of completing
        ? [['resolved', 'Mark as resolved and close']]
        : [['accepted', 'Accept for manual handling'], ['dismissed', 'Dismiss as false positive']]) {
        const option = d.createElement('option'); option.value = value; option.textContent = label; select.append(option);
      }
      nextForm.append(select);
      const reasonLabel = append(nextForm, 'label', 'Review notes'); reasonLabel.className = 'field';
      reasonLabel.htmlFor = 'manual-review-reason';
      const reason = d.createElement('textarea'); reason.id = 'manual-review-reason'; reason.name = 'reason'; reason.maxLength = 2000;
      reason.placeholder = completing
        ? 'Required: summarize how the incident was resolved.'
        : 'Required when dismissing; recommended for the audit trail.'; nextForm.append(reason);
      const help = append(nextForm, 'p', completing
        ? 'Resolving closes the incident and preserves these notes in the audit trail.'
        : 'Accepting keeps the incident open for analyst investigation. Dismissing closes it without containment.');
      help.id = 'manual-review-help'; help.className = 'dialog-help';
      const error = append(nextForm, 'p', '', { decisionError: '' }); error.id = 'decision-error';
      error.setAttribute('role', 'alert'); error.setAttribute('aria-live', 'assertive');
      const actions = append(nextForm, 'div', ''); actions.className = 'dialog-actions';
      const cancel = append(actions, 'button', 'Cancel', { closeDialog: '' }); cancel.type = 'button'; cancel.className = 'button button-quiet';
      const confirm = append(actions, 'button', completing ? 'Resolve and close' : 'Record review'); confirm.type = 'submit'; confirm.className = 'button button-primary';
      box.append(nextForm); host.append(box); bindDecision();
      return;
    }

    const box = d.createElement('dialog');
    box.id = 'decision-dialog';
    box.setAttribute('aria-labelledby', 'decision-heading');
    box.setAttribute('aria-describedby', 'decision-help decision-error');
    const dialogHeader = append(box, 'div', ''); dialogHeader.className = 'dialog-header';
    append(dialogHeader, 'p', 'Human approval gate').className = 'eyebrow';
    const title = append(dialogHeader, 'h2', 'Review containment decision');
    title.id = 'decision-heading';
    append(dialogHeader, 'p', 'Approve only if every action is appropriate for this incident and target.');
    const nextForm = d.createElement('form');
    nextForm.className = 'decision-form';
    nextForm.dataset.decisionForm = '';
    nextForm.dataset.incidentId = id;
    nextForm.dataset.planBinding =
      detail.plan.planId + ':' + detail.plan.planHashVersion + ':' +
      detail.plan.planHash + ':' + detail.plan.expiresAt;
    for (const [name, value] of [
      ['csrfToken', csrf],
      ['planId', detail.plan.planId],
      ['planHashVersion', String(detail.plan.planHashVersion)],
      ['planHash', detail.plan.planHash],
      ['planExpiresAt', detail.plan.expiresAt],
    ]) {
      const input = d.createElement('input');
      input.type = 'hidden'; input.name = name; input.value = value;
      nextForm.append(input);
    }
    const decisionLabel = append(nextForm, 'label', 'Decision'); decisionLabel.className = 'field';
    decisionLabel.htmlFor = 'decision-select';
    const select = d.createElement('select');
    select.id = 'decision-select'; select.name = 'decision';
    for (const value of ['approved', 'rejected']) {
      const option = d.createElement('option'); option.value = value;
      option.textContent = value === 'approved' ? 'Approve proposed actions' : 'Reject proposed actions'; select.append(option);
    }
    nextForm.append(select);
    const reasonLabel = append(nextForm, 'label', 'Decision notes'); reasonLabel.className = 'field';
    reasonLabel.htmlFor = 'decision-reason';
    const reason = d.createElement('textarea');
    reason.id = 'decision-reason'; reason.name = 'reason'; reason.maxLength = 2000;
    reason.placeholder = 'Required when rejecting; optional when approving.';
    reason.setAttribute('aria-describedby', 'decision-help'); nextForm.append(reason);
    const help = append(nextForm, 'p', 'Your decision is recorded in the incident audit trail. Approved actions execute only within the verified scope above.');
    help.id = 'decision-help';
    help.className = 'dialog-help';
    const error = append(nextForm, 'p', '', { decisionError: '' });
    error.id = 'decision-error';
    error.setAttribute('role', 'alert');
    error.setAttribute('aria-live', 'assertive');
    const actions = append(nextForm, 'div', ''); actions.className = 'dialog-actions';
    const cancel = append(actions, 'button', 'Cancel', { closeDialog: '' }); cancel.type = 'button'; cancel.className = 'button button-quiet';
    const confirm = append(actions, 'button', 'Confirm decision'); confirm.type = 'submit'; confirm.className = 'button button-primary';
    box.append(nextForm); host.append(box); bindDecision();
  };
  const render = (detail) => {
    renderEvidence(detail);
    renderTriage(detail);
    renderDecisionPanel(detail);
    renderRunbook(detail);
    renderOperational(detail);
    renderDecision(detail);
  };
  const apply = (detail) => {
    const next = sequence(detail.timelineCursor);
    if (!Number.isSafeInteger(next) || next < confirmed) return false;
    render(detail);
    const timeline = query('[data-timeline]');
    if (timeline) {
      timeline.replaceChildren();
      for (const event of detail.timeline || []) {
        const article = append(timeline, 'article', '', { timelineEvent: String(event.sequence) });
        append(article, 'span', '').className = 'timeline-dot';
        const copy = append(article, 'div', '');
        append(copy, 'strong', eventLabel(event.type));
        const time = append(copy, 'time', formatDate(event.occurredAt)); time.dateTime = event.occurredAt;
        const entries = Object.entries(event.payloadRedacted || {});
        if (entries.length) {
          const technical = append(copy, 'details', ''); technical.className = 'event-details';
          append(technical, 'summary', 'Event details');
          const list = append(technical, 'dl', '');
          for (const [key, value] of entries) {
            const row = append(list, 'div', ''); append(row, 'dt', words(key)); append(row, 'dd', String(value));
          }
        }
      }
    }
    const summary = query('[data-incident-summary]');
    if (summary) {
      if (typeof summary.replaceChildren !== 'function')
        summary.textContent = (detail.incident.severity || 'unclassified') + ' · ' + detail.incident.status;
      else {
        summary.replaceChildren();
        const severity = append(summary, 'span', words(detail.incident.severity || 'unclassified') + ' severity');
        severity.className = 'badge severity-' + (detail.incident.severity || 'unclassified');
        append(summary, 'span', words(detail.incident.status)).className = 'badge badge-neutral';
      }
    }
    confirmed = next;
    received = Math.max(received, next);
    root.dataset.timelineCursor = detail.timelineCursor;
    return true;
  };
  async function refresh(requestEpoch = 0) {
    const effectiveEpoch = pendingResyncEpoch || requestEpoch;
    if (refreshing) {
      queued = true;
      queuedEpoch = Math.max(queuedEpoch, effectiveEpoch);
      return false;
    }
    refreshing = true;
    let applied = false;
    try {
      const response = await fetch('/api/incidents/' + encodeURIComponent(id), { cache: 'no-store' });
      if (!response.ok) throw Error('detail refresh failed');
      applied = apply(await response.json());
      if (applied && retryEpoch === effectiveEpoch) {
        retryAttempt = 0;
        if (retryTimer && typeof clearTimeout === 'function') clearTimeout(retryTimer);
        retryTimer = null;
      }
      return applied;
    } catch {
      received = confirmed;
      say('Incident refresh failed. Showing last confirmed state.');
      scheduleRetry(effectiveEpoch);
      return false;
    } finally {
      refreshing = false;
      // A pending generation owns reconnection. A normal refresh queued by a
      // POST while it was in flight is absorbed by its authoritative snapshot.
      if (pendingResyncEpoch && pendingResyncEpoch === effectiveEpoch && applied) {
        pendingResyncEpoch = 0;
        queued = false;
        queuedEpoch = 0;
        source?.close();
        connect();
      } else if (queued) {
        const nextEpoch = queuedEpoch;
        queued = false;
        queuedEpoch = 0;
        void refresh(nextEpoch);
      }
    }
  }
  const scheduleRetry = (requestEpoch) => {
    if (pendingResyncEpoch && requestEpoch !== pendingResyncEpoch) return;
    if (retryEpoch !== requestEpoch) {
      retryEpoch = requestEpoch;
      retryAttempt = 0;
    }
    if (retryTimer || retryAttempt >= 3) return;
    const delay = Math.min(1_000 * 2 ** retryAttempt, 4_000);
    retryAttempt += 1;
    retryTimer = setTimeout(() => {
      retryTimer = null;
      if (!pendingResyncEpoch || pendingResyncEpoch === requestEpoch)
        void refresh(requestEpoch);
    }, delay);
  };
  const requestResync = () => {
    const requestEpoch = ++epoch;
    pendingResyncEpoch = requestEpoch;
    received = confirmed;
    source?.close();
    if (retryTimer) {
      if (typeof clearTimeout === 'function') clearTimeout(retryTimer);
      retryTimer = null;
    }
    retryEpoch = requestEpoch;
    retryAttempt = 0;
    void refresh(requestEpoch);
  };
  const connect = () => {
    source = new EventSource('/api/incidents/' + encodeURIComponent(id) + '/events?resync=stream&after=' + encodeURIComponent(id + ':' + confirmed));
    source.onmessage = (event) => {
      let payload;
      try { payload = JSON.parse(event.data); }
      catch { requestResync(); return; }
      const next = Number(payload.sequence);
      if (!Number.isSafeInteger(next) || next <= confirmed) return;
      if (next !== received + 1) { requestResync(); return; }
      received = next;
      void refresh();
    };
    source.addEventListener('resync', requestResync);
  };
  bindDecision();
  bindDeviceAuthorization();
  connect();
})();`;
