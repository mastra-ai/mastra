import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

describe('release README', () => {
  it('keeps the approved template structure and local-first entry points', async () => {
    const readme = await readFile('README.md', 'utf8');
    expect(readme.match(/^## .+$/gm)).toEqual([
      '## Why we built this',
      '## Demo',
      '## Prerequisites',
      '## Quickstart 🚀',
      '## Try it out',
      '## Making it yours',
      '## Try the complete flow without credentials',
      '## About Mastra templates',
    ]);
    const quickstart = readme.split('## Quickstart 🚀')[1]!.split('\n## ')[0]!;
    expect(quickstart.match(/^\d\. \*\*.+\*\*$/gm)).toEqual([
      '1. **Clone the template**',
      '2. **Add your API keys**',
      '3. **Start the dev server**',
    ]);
    const experiments = readme.split('## Try it out')[1]!.split('\n## ')[0]!;
    expect(experiments.match(/^- /gm)?.length).toBeGreaterThanOrEqual(3);
    expect(experiments.match(/^- /gm)?.length).toBeLessThanOrEqual(5);
    expect(readme).toContain('--template security-incident-triage-and-response');
    expect(readme).toContain('[Mastra monorepo](https://github.com/mastra-ai/mastra)');
    for (const [, path] of readme.matchAll(/\]\(([^)]+)\)/gu)) {
      if (path!.startsWith('http')) continue;
      expect((await readFile(path!, 'utf8')).length).toBeGreaterThan(0);
    }
    expect(readme).toContain('npm run demo:local');
  });
  it('presents the product workflow and its production boundaries', async () => {
    const readme = await readFile('README.md', 'utf8');

    expect(readme).toContain('securityIncidentWorkflow');
    expect(readme).toContain('await-approval');
    expect(readme).toContain('WorkOS');
    expect(readme).toContain('IPinfo');
    expect(readme).toContain('Linear');
  });

  it('documents the Studio entry point and a fresh sample input', async () => {
    const readme = await readFile('README.md', 'utf8');

    expect(readme).toContain('npm run dev');
    expect(readme).not.toMatch(/npm run dev:(?:server|studio)/u);
    expect(readme).toContain('http://localhost:4111');
    expect(readme).toContain('scripts/fixtures/studio/01-new-device.json');
    expect(readme).toContain('scripts/fixtures/studio/resolve.json');
    expect(readme).toContain('scripts/fixtures/studio/reject.json');
  });

  it('keeps release and ownership metadata factual', async () => {
    const [readme, contributing, manifest, license] = await Promise.all([
      readFile('README.md', 'utf8'),
      readFile('CONTRIBUTING.md', 'utf8'),
      readFile('package.json', 'utf8'),
      readFile('LICENSE', 'utf8'),
    ]);

    expect(readme).toContain('contributed by Diego');
    expect(contributing).toContain('contributed by Diego');
    expect(JSON.parse(manifest)).toMatchObject({
      name: 'template-security-incident-triage',
      private: true,
      license: 'Apache-2.0',
    });
    expect(license).toMatch(/^Apache License\nVersion 2\.0, January 2004/);
  });
});
