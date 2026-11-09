import { downloadFilename } from './download-filename.ts';
import type { ReviewState, ReviewDecision } from '../../src/mastra/contracts/review.ts';
export type { ReviewState, ReviewDecision };
export type Questionnaire = {
  runId: string;
  name: string;
  state: string;
  error: string | null;
  metrics: boolean;
  download: string | null;
};
export type Detail = Questionnaire & {
  review?: ReviewState;
  dispositions: ReviewDecision['dispositions'];
  documents: { id: string; label: string; disclosure: string }[];
  prompt: { id: string; text: string; context: string } | null;
};
export type Metrics = Awaited<ReturnType<typeof import('../../src/mastra/observability/metrics.ts').readDomainMetrics>>;
export let token = '';
export const setToken = (value: string) => {
  token = value;
};
const errorMessages: Record<string, string> = {
  REQUEST_LIMIT: 'Too many changes were submitted. Wait one minute before trying again.',
  ACTIVE_RUN_LIMIT: 'Two questionnaires are already active. Finish or cancel one before starting more work.',
  EXHAUSTED_REVIEW_REQUIRES_TRUSTED_GAPS:
    'This run has reached its processing time, call or cost limit. To finish without more model calls, mark every answer as unknown or withheld, using the default reasons and no corrections or evidence releases. To produce supported answers, start a new run with an appropriate execution policy.',
  EXPLANATION_FIELD_REQUIRED:
    'This questionnaire needs an explanation field for choice answers. Add and map that field, then upload the updated file. For the demo, use the current sample with Explanation and Evidence columns.',
  INVALID_MAPPING:
    'A field or citation could not be matched to its source. During review, check the questions flagged INVALID_ATTRIBUTION; mark those answers as unknown or withheld, then select Review again.',
  INVALID_ATTRIBUTION:
    'A quotation does not match its cited source. Check the flagged questions and mark those answers as unknown or withheld. Editing only the answer does not repair a citation.',
  SECURITY_BLOCKED:
    'A safety check blocked the submitted content. Check the answers you edited and their evidence before retrying.',
  UNSUPPORTED_CORRECTION:
    'An edited answer could not be verified against its evidence. Remove unsupported claims or mark the answer as unknown.',
  UNSUPPORTED_REVIEW:
    'One or more drafts still need attention. Edit the answers to address their review notes, or mark them as unknown or withheld.',
  FORBIDDEN_DISCLOSURE:
    'A cited source cannot be shared or needs your explicit permission. Check the sharing policy shown with each answer.',
  SOURCE_DRIFT:
    'The evidence or its sharing policy has changed. Start a new run with the current sources before approving an export.',
  INCOMPATIBLE_RESPONSE:
    'An answer does not fit the questionnaire’s allowed choices or length. Check the edited answers.',
};
export const errorMessage = (code: string) => (errorMessages[code] ? `${errorMessages[code]} (${code})` : code);
export async function request(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(path, { ...init, headers, cache: 'no-store' });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    if (data.error === 'PROFILE_NOT_CONFIGURED')
      throw new Error('Evidence profile is missing. Run npm run demo in the template directory, then upload again.');
    throw new Error(response.status === 401 ? '401' : errorMessage(data.error ?? `HTTP ${response.status}`));
  }
  return response;
}
export async function json<T>(path: string, body?: unknown): Promise<T> {
  return (
    await request(
      path,
      body === undefined
        ? {}
        : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
    )
  ).json();
}
export async function download(path: string) {
  const response = await request(path),
    url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = downloadFilename(response.headers);
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
