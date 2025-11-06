import { progress } from '@clack/prompts';
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

function runCodemods(codemods: string[], options: TransformOptions, versionLabel: string) {
  const cwd = process.cwd();
  log(`Starting ${versionLabel} codemods...`);
  const modCount = codemods.length;
  const p = progress({ size: modCount });

  p.start('Starting...');

  const allErrors: TransformErrors = [];
  let notImplementedAvailable = false;
  for (const [_, codemod] of codemods.entries()) {
    const { errors, notImplementedErrors } = transform(codemod, cwd, options, {
      logStatus: false,
    });
    allErrors.push(...errors);
    if (notImplementedErrors.length > 0) {
      notImplementedAvailable = true;
    }
    p.advance(1, `Codemod: ${codemod}`);
  }
  p.stop('Ran all codemods.');

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

  log(`${versionLabel} codemods complete.`);
}

export function upgradeV1(options: TransformOptions) {
  runCodemods(v1Bundle, options, 'v1');
}
