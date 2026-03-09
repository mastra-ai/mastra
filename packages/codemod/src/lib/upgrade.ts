import { spinner, intro, outro } from '@clack/prompts';
import debug from 'debug';
import { BUNDLE } from './bundle';
import type { TransformErrors } from './transform';
import { transform } from './transform';

interface TransformOptions {
  dry?: true;
  print?: true;
  verbose?: true;
  jscodeshift?: string;
}

const log = debug('codemod:upgrade');
const error = debug('codemod:upgrade:error');

// Extract v1 codemods from the bundle
const v1Bundle = BUNDLE.filter(codemod => codemod.startsWith('v1/'));

async function runCodemods(codemods: string[], options: TransformOptions, versionLabel: string) {
  const cwd = process.cwd();
  intro(`Starting ${versionLabel} codemods`);
  const modCount = codemods.length;
  const s = spinner();

  s.start(`Running ${modCount} ${versionLabel} codemods`);

  const allErrors: TransformErrors = [];
  let notImplementedAvailable = false;
  let count = 0;
  for (const [_, codemod] of codemods.entries()) {
    const { errors, notImplementedErrors } = await transform(codemod, cwd, options, {
      logStatus: false,
    });
    allErrors.push(...errors);
    if (notImplementedErrors.length > 0) {
      notImplementedAvailable = true;
    }
    count++;
    s.message(`Codemod ${count}/${modCount} (${codemod})`);
  }
  s.stop(`Ran ${count}/${modCount} codemods.`);

  if (allErrors.length > 0) {
    log(`Some ${versionLabel} codemods did not apply successfully to all files. Details:`);
    allErrors.forEach(({ transform, filename, summary }) => {
      error(`codemod=${transform}, path=${filename}, summary=${summary}`);
    });
  }

  if (notImplementedAvailable) {
    log(
      `Some ${versionLabel} codemods require manual changes. Please search your codebase for \`FIXME(mastra): \` comments and follow the instructions to complete the upgrade.`,
    );
  }

  outro(`${versionLabel} codemods complete.`);
}

export async function upgradeV1(options: TransformOptions) {
  await runCodemods(v1Bundle, options, 'v1');
}
