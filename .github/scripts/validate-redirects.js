import path from 'path';
import { pathToFileURL } from 'url';
import process from 'process';

const loadRedirects = async () => {
  process.chdir('docs');

  const configPath = path.resolve('next.config.mjs');
  const configUrl = pathToFileURL(configPath).href;
  const configModule = await import(configUrl);

  const resolvedConfig =
    typeof configModule.default === 'function' ? await configModule.default() : configModule.default;

  const redirectsFn = resolvedConfig?.redirects;
  const redirects = typeof redirectsFn === 'function' ? await redirectsFn() : redirectsFn;

  return redirects;
};

const checkRedirects = async () => {
  const start = Date.now();

  const redirects = await loadRedirects();
  let skipped = 0;
  let successful = 0;
  let broken = 0;

  for (const redirect of redirects) {
    const url = `https://mastra.ai${redirect.source}`;

    if (!redirect.source.startsWith('/')) {
      skipped++;
      continue;
    }

    try {
      const res = await fetch(url, { redirect: 'follow' });

      if (res.status === 404) {
        console.log('├─BROKEN─', url);
        console.dir(redirect, { depth: null });
        broken++;
      } else {
        console.log('├───OK───', url);
        successful++;
      }
    } catch (err) {
      console.log('├─BROKEN─', url);
      console.dir(redirect, { depth: null });
      broken++;
    }
  }

  const elapsed = Math.floor((Date.now() - start) / 1000);
  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;

  console.log('\n' + '='.repeat(35));
  console.log(`Links found: ${redirects.length}`);
  console.log(`Links skipped: ${skipped}`);
  console.log(`Links successful: ${successful}`);
  console.log(`Links broken: ${broken}`);
  console.log(`Time elapsed: ${minutes} minutes, ${seconds} seconds`);
  console.log('='.repeat(35));

  process.exit(broken > 0 ? 1 : 0);
};

checkRedirects().catch(console.error);
