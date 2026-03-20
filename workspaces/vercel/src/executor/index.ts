/**
 * Executor function source code deployed to Vercel as a serverless function.
 *
 * Returns a string because it's sent as inline file content via
 * the Vercel Deployments API — no separate build step needed.
 *
 * The secret and user env vars are embedded as constants in the source
 * because the Vercel Deployments API does not support setting env vars
 * directly — they must be configured via vercel.json or project settings.
 */
export function getExecutorSource(secret: string, env: Record<string, string>): string {
  const envEntries = Object.entries(env)
    .map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`)
    .join(',\n');

  return `
const { execFileSync } = require('child_process');

const SANDBOX_SECRET = ${JSON.stringify(secret)};
const SANDBOX_ENV = {
${envEntries}
};

module.exports = async (req, res) => {
  // Auth check
  const authHeader = req.headers['authorization'] || '';
  if (!SANDBOX_SECRET || authHeader !== 'Bearer ' + SANDBOX_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { command, args = [], env = {}, cwd, timeout = 55000 } = req.body || {};

  if (!command) {
    return res.status(400).json({ error: 'Missing required field: command' });
  }

  const execCwd = cwd || '/tmp';
  const execEnv = { ...process.env, ...SANDBOX_ENV, ...env };

  const startTime = Date.now();
  let timedOut = false;

  try {
    const stdout = execFileSync(command, args, {
      cwd: execCwd,
      env: execEnv,
      timeout,
      maxBuffer: 10 * 1024 * 1024,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    return res.status(200).json({
      success: true,
      exitCode: 0,
      stdout: stdout || '',
      stderr: '',
      executionTimeMs: Date.now() - startTime,
      timedOut: false,
    });
  } catch (error) {
    timedOut = error.killed || false;

    return res.status(200).json({
      success: false,
      exitCode: error.status != null ? error.status : 1,
      stdout: error.stdout || '',
      stderr: error.stderr || '',
      executionTimeMs: Date.now() - startTime,
      timedOut,
    });
  }
};
`;
}
