import { register } from 'node:module';
if (process.argv.length !== 3 || process.argv[2] !== '--live' || !process.env.OPENAI_API_KEY?.trim()) {
  console.error('OpenAI smoke is unverified: --live and an explicitly selected OPENAI_API_KEY are required.');
  process.exitCode = 1;
} else {
  register('./typescript-loader.mjs', import.meta.url);
  try {
    await import('./test-openai-smoke.ts');
  } catch {
    console.error('OpenAI smoke failed; no live verification is claimed.');
    process.exitCode = 1;
  }
}
