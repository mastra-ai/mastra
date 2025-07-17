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
  let brokenSource = 0;
  let brokenDestination = 0;

  for (const redirect of redirects) {
    const sourceUrl = `https://mastra.ai${redirect.source}`;
    const destinationUrl = `https://mastra.ai${redirect.destination}`;

    if (!redirect.source.startsWith('/')) {
      skipped++;
      continue;
    }

    let sourceOk = false;
    let destinationOk = false;

    try {
      const sourceRes = await fetch(sourceUrl, { redirect: 'follow' });
      sourceOk = sourceRes.status !== 404;
    } catch {
      sourceOk = false;
    }

    try {
      const destRes = await fetch(destinationUrl, { redirect: 'follow' });
      destinationOk = destRes.status !== 404;
    } catch {
      destinationOk = false;
    }

    if (sourceOk && destinationOk) {
      console.log('├───OK───', sourceUrl);
      successful++;
    } else {
      if (!sourceOk) {
        console.log('├─BROKEN SOURCE────', sourceUrl);
        brokenSource++;
      }
      if (!destinationOk) {
        console.log('├─BROKEN DESTINATION────', destinationUrl);
        brokenDestination++;
      }
      console.dir(redirect, { depth: null });
      console.log(' ');
    }
  }

  const elapsed = Math.floor((Date.now() - start) / 1000);
  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;

  console.log('\n' + '='.repeat(40));
  console.log(`Links found: ${redirects.length}`);
  console.log(`Links skipped: ${skipped}`);
  console.log(`Redirects OK: ${successful}`);
  console.log(`Broken sources: ${brokenSource}`);
  console.log(`Broken destinations: ${brokenDestination}`);
  console.log(`Time elapsed: ${minutes} minutes, ${seconds} seconds`);
  console.log('='.repeat(40));

  process.exit(brokenSource + brokenDestination > 0 ? 1 : 0);
};

checkRedirects().catch(console.error);
