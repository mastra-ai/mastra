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
export async function request(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(path, { ...init, headers, cache: 'no-store' });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(response.status === 401 ? '401' : (data.error ?? `HTTP ${response.status}`));
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
  link.download = response.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1] ?? 'answered';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
