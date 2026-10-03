import { createExampleServer } from './http.js';
import { persistence, storage, provider } from './provider.js';
import { editorialReview } from './workflow.js';
import { createAdmission, admissionLimitsFromEnv } from './admission.js';
import { uploadLimitsFromEnv } from './uploads.js';

const tokens: unknown = JSON.parse(process.env.DEMO_API_TOKENS ?? '{}');
if (
  !tokens ||
  typeof tokens !== 'object' ||
  Array.isArray(tokens) ||
  Object.values(tokens).some(token => typeof token !== 'string')
)
  throw new Error('DEMO_API_TOKENS must be a JSON map of user names to tokens');
const uploadLimits = uploadLimitsFromEnv(process.env);
const admission = createAdmission({
  connectionString: process.env.DATABASE_URL!,
  namespace: editorialReview.id,
  limits: admissionLimitsFromEnv(process.env),
  getStatus: async runId => (await provider.getRun(editorialReview.id, runId))?.status ?? null,
});
const server = createExampleServer(tokens as Record<string, string>, admission, uploadLimits);
const port = Number(process.env.PORT ?? 4318);
const host = process.env.HOST ?? '127.0.0.1';
server.listen(port, host, () => console.log(`Editorial review: http://${host}:${port}`));
let closing: Promise<void> | undefined;
/** Drain HTTP handlers once before closing the example's owned storage resources. */
function close() {
  return (closing ??= (async () => {
    await new Promise<void>((resolve, reject) => server.close(error => (error ? reject(error) : resolve())));
    // Status refreshes read provider persistence, so drain them before closing that dependency.
    await admission.close();
    await persistence.close();
    await storage.close();
  })());
}
process.once('SIGINT', () => {
  void close();
});
process.once('SIGTERM', () => {
  void close();
});
