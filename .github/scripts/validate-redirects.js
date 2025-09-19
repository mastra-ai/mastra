import path from 'path';
import { pathToFileURL } from 'url';
import process from 'process';

const baseUrl = process.env.MASTRA_DEPLOYMENT_URL || 'https://mastra.ai'; //'localhost:3000';

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
  const sourceMap = new Map();
  const duplicateSourceGroups = new Map();
  const nonLocaleAwareRedirects = [];

  for (const redirect of redirects) {
    if (!redirect || typeof redirect !== 'object') continue;

    const { source, destination } = redirect;
    if (!source) continue;

    // Check if redirect is locale aware
    if (!source.includes('/:locale')) {
      nonLocaleAwareRedirects.push(redirect);
    }

    if (sourceMap.has(source)) {
      if (!duplicateSourceGroups.has(source)) {
        duplicateSourceGroups.set(source, [sourceMap.get(source)]);
      }
      duplicateSourceGroups.get(source).push(redirect);
    } else {
      sourceMap.set(source, redirect);
    }
  }

  let skipped = 0;
  let successful = 0;
  let brokenDestination = 0;

  for (const redirect of redirects) {
    if (!redirect || typeof redirect !== 'object') continue;
    const { destination } = redirect;
    if (!destination) continue;

    if (destination.includes(':path*')) {
      console.log('├──SKIPPED──', `${baseUrl}${destination}`);
      skipped++;
      continue;
    }

    const destinationUrl = `${baseUrl}${destination}`;
    let destinationOk = false;

    try {
      const destRes = await fetch(destinationUrl, { redirect: 'follow' });
      destinationOk = destRes.status !== 404;
    } catch {
      destinationOk = false;
    }

    if (destinationOk) {
      console.log('├──OK──', destinationUrl);
      successful++;
    } else {
      console.log(' ');
      console.log('├──BROKEN──', destinationUrl);
      console.log('⚠️  Update destination URL in redirect object:');
      console.dir(redirect, { depth: null });
      console.log(' ');
      brokenDestination++;
    }
  }

  if (duplicateSourceGroups.size > 0) {
    console.log('\n' + '='.repeat(40));
    console.log('Duplicate sources found:\n');
    for (const [source, group] of duplicateSourceGroups.entries()) {
      console.log('├──DUPLICATE SOURCE──', `${baseUrl}${source}`);
      group.forEach(redirect => {
        console.dir(redirect, { depth: null });
      });
      console.log(' ');
    }
  }

  if (nonLocaleAwareRedirects.length > 0) {
    console.log('\n' + '='.repeat(40));
    console.log('Non-locale aware redirects found:\n');
    for (const redirect of nonLocaleAwareRedirects) {
      console.log('├──NON-LOCALE AWARE──', `${baseUrl}${redirect.source}`);
      console.log('⚠️  Redirect source should include /:locale parameter:');
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
  console.log(`Broken destinations: ${brokenDestination}`);
  console.log(`Duplicate sources: ${duplicateSourceGroups.size}`);
  console.log(`Non-locale aware redirects: ${nonLocaleAwareRedirects.length}`);
  console.log(`Time elapsed: ${minutes} minutes, ${seconds} seconds`);
  console.log('='.repeat(40));

  process.exit(brokenDestination > 0 || duplicateSourceGroups.size > 0 || nonLocaleAwareRedirects.length > 0 ? 1 : 0);
};

checkRedirects().catch(console.error);
