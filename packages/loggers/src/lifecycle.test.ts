import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, it, expect } from 'vitest';

const tsxLoader = pathToFileURL(createRequire(import.meta.url).resolve('tsx')).href;

const transports = {
  HttpTransport: {
    module: pathToFileURL(fileURLToPath(new URL('./http/index.ts', import.meta.url))).href,
    options: { url: 'https://example.invalid/logs', flushInterval: 200 },
  },
  UpstashTransport: {
    module: pathToFileURL(fileURLToPath(new URL('./upstash/index.ts', import.meta.url))).href,
    options: { upstashUrl: 'https://example.invalid', upstashToken: 'token', flushInterval: 200 },
  },
};

// Runs a script in a fresh Node process with a mocked fetch, and reports how many requests it made before exiting.
function runScript(name: keyof typeof transports, body: string) {
  const { module, options } = transports[name];
  const script = `
    let requests = 0;
    globalThis.fetch = async () => {
      requests++;
      return { ok: true, json: async () => ({}) };
    };
    process.on('exit', () => console.log('requests=' + requests));
    const { ${name} } = await import(${JSON.stringify(module)});
    const transport = new ${name}(${JSON.stringify(options)});
    ${body}
  `;
  const result = spawnSync(process.execPath, ['--import', tsxLoader, '--input-type=module', '-e', script], {
    encoding: 'utf8',
    timeout: 10_000,
  });
  return { status: result.status, signal: result.signal, stdout: result.stdout, stderr: result.stderr };
}

describe.each(Object.keys(transports) as (keyof typeof transports)[])(
  '%s process lifetime',
  { timeout: 15_000 },
  name => {
    it('lets an idle process exit', () => {
      const result = runScript(name, '');
      expect(result.signal, result.stderr).toBeNull();
      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout).toContain('requests=0');
    });

    it('lets the process exit after an explicit flush', () => {
      const result = runScript(name, `transport.write(JSON.stringify({ msg: 'hello' })); await transport._flush();`);
      expect(result.signal, result.stderr).toBeNull();
      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout).toContain('requests=1');
    });

    it('waits for the next interval flush before exiting with buffered logs', () => {
      const result = runScript(name, `transport.write(JSON.stringify({ msg: 'hello' }));`);
      expect(result.signal, result.stderr).toBeNull();
      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout).toContain('requests=1');
    });
  },
);
