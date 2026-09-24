const element = id => document.getElementById(id);
let token = sessionStorage.getItem('review-token') || '';
let runId = new URL(location.href).searchParams.get('run') || localStorage.getItem('review-run') || '';
let timer;
let connected = false;
element('token').value = token;
const terminal = status => ['success', 'failed', 'canceled'].includes(status);
async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
  });
  const body = await response.json();
  if (!response.ok) {
    if (body.runId) remember(body.runId);
    if (body.status === 'submission-unknown') {
      show(body);
      element('submit').disabled = true;
    }
    const error = new Error(body.error || 'Request failed');
    error.status = response.status;
    throw error;
  }
  return body;
}
function remember(id) {
  runId = id;
  localStorage.setItem('review-run', id);
  const url = new URL(location.href);
  url.searchParams.set('run', id);
  history.replaceState({}, '', url);
}
function show(job) {
  element('status').textContent = job.status;
  element('status').dataset.state = job.status;
  element('job-id').textContent = `Job ${runId}`;
  element('job-help').textContent =
    job.error ||
    (terminal(job.status)
      ? 'This job has finished. You can submit another draft.'
      : job.status === 'submission-unknown'
        ? 'Acceptance is uncertain. Inspect this job before submitting again.'
        : 'The job runs in the background. Refreshing does not start it again.');
  element('cancel').disabled =
    terminal(job.status) || ['submission-unknown', 'cancel-requested', 'submitting'].includes(job.status);
  element('refresh').disabled = false;
  element('submit').disabled = !connected || !terminal(job.status);
  const result = job.result?.result;
  element('result').textContent =
    result?.revisedDraft || (job.status === 'failed' ? 'No revision was produced.' : 'Waiting for the result.');
  element('findings').replaceChildren(
    ...(result?.findings || []).map(finding => {
      const item = document.createElement('li');
      item.textContent = `${finding.focus}: ${finding.feedback}`;
      return item;
    }),
  );
  clearTimeout(timer);
  if (!terminal(job.status) && job.status !== 'submission-unknown') timer = setTimeout(refresh, 1000);
}
async function refresh() {
  if (!runId || !connected) return;
  try {
    show(await api(`/api/jobs/${encodeURIComponent(runId)}`));
    element('message').textContent = '';
  } catch (error) {
    element('message').textContent = error.message;
  }
}
element('connect').onclick = async () => {
  token = element('token').value;
  try {
    const config = await api('/api/config');
    connected = true;
    sessionStorage.setItem('review-token', token);
    element('mode').textContent =
      config.mode === 'agent'
        ? `Agent mode · ${config.owner}`
        : `Deterministic preview · ${config.owner} · no model calls`;
    element('submit').disabled = false;
    element('message').textContent = '';
    await refresh();
  } catch (error) {
    connected = false;
    element('submit').disabled = true;
    element('message').textContent = error.message;
  }
};
element('form').onsubmit = async event => {
  event.preventDefault();
  element('submit').disabled = true;
  element('message').textContent = '';
  remember(crypto.randomUUID());
  try {
    const job = await api('/api/jobs', {
      method: 'POST',
      body: JSON.stringify({
        runId,
        draft: element('draft').value,
        criteria: element('criteria').value,
        demoFailure: element('failure').checked,
      }),
    });
    remember(job.runId);
    await refresh();
  } catch (error) {
    if (!error.status || error.status >= 500)
      show({
        status: 'submission-unknown',
        error: 'Submission could not be confirmed. Refresh this job to check before starting another.',
      });
    else element('submit').disabled = false;
    element('message').textContent = error.message;
  }
};
element('cancel').onclick = async () => {
  element('cancel').disabled = true;
  try {
    await api(`/api/jobs/${encodeURIComponent(runId)}/cancel`, { method: 'POST' });
    await refresh();
  } catch (error) {
    element('message').textContent = error.message;
    await refresh();
  }
};
element('refresh').onclick = refresh;
if (token) element('connect').click();
