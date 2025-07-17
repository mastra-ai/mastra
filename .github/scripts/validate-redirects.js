import path from 'path';
import { pathToFileURL } from 'url';
import process from 'process';

const baseUrl = 'https://mastra.ai';

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
  let brokenDestination = 0;

  for (const redirect of redirects) {
    if (redirect.destination.includes(':path*')) {
      console.log('├───SKIPPED───', `${baseUrl}${redirect.destination}`);
      skipped++;
      continue;
    }

    const destinationUrl = `${baseUrl}${redirect.destination}`;

    let destinationOk = false;

    try {
      const destRes = await fetch(destinationUrl, { redirect: 'follow' });
      destinationOk = destRes.status !== 404;
    } catch {
      destinationOk = false;
    }

    if (destinationOk) {
      console.log('├───OK───', destinationUrl);
      successful++;
    } else {
      console.log(' ');
      console.log('├───BROKEN───', destinationUrl);
      console.log('⚠️  Update destination URL in redirect object:');
      console.dir(redirect, { depth: null });
      console.log(' ');
      brokenDestination++;
    }
  }

  const elapsed = Math.floor((Date.now() - start) / 1000);
  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;

  console.log('\n' + '='.repeat(40));
  console.log(`Links found: ${redirects.length}`);
  console.log(`Links skipped: ${skipped}`);
  console.log(`Redirects OK: ${successful}`);
  console.log(`Broken destinations: ${brokenDestination}`);
  console.log(`Time elapsed: ${minutes} minutes, ${seconds} seconds`);
  console.log('='.repeat(40));

  process.exit(brokenDestination > 0 ? 1 : 0);
};

checkRedirects().catch(console.error);
