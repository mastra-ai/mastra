import * as p from '@clack/prompts';
import { ExecaError } from 'execa';
import path from 'path';
import color from 'picocolors';
import prettier from 'prettier';

import fsExtra from 'fs-extra/esm';
import fs from 'fs/promises';

import { toCamelCase } from '../../utils.js';
import { logger } from '../../utils/logger.js';
import { getConfig } from '../init/get-config.js';
import { modelToConfigMap } from '../init/utils.js';

export async function createNewAgent() {
  console.clear();

  p.intro(color.bgCyan(color.black(' New Agent ')));
  const answers = await p.group(
    {
      name: () =>
        p.text({
          message: 'What is the name of your agent?',
          validate: value => {
            if (value.trim() === '') {
              return 'Name cannot be empty';
            }
            return;
          },
        }),
      prompt: () =>
        p.text({
          message: 'Provide a prompt for your agent',
          validate: value => {
            if (value.trim() === '') {
              return 'Prompt cannot be empty';
            }
            return;
          },
        }),
    },
    {
      onCancel: () => {
        p.cancel('Agent creation cancelled');
        process.exit(0);
      },
    },
  );

  try {
    const config = await getConfig(process.cwd());

    if (!config) {
      logger.warn(`
        Config is missing. Please run ${color.green(`init`)} to create a config.json file
        `);
      process.exit();
    }

    const model = modelToConfigMap[config.llmProvider];

    const agentCode = `
export const ${toCamelCase(answers.name)} = new Agent({
  name: "${toCamelCase(answers.name)}",
  instructions: "${answers.prompt}",
  model: ${JSON.stringify(model, null, 2)}
});
`;

    const formattedAgent = await prettier.format(agentCode, {
      parser: 'typescript',
      singleQuote: true,
    });

    await fsExtra.ensureFile(`${config.dirPath}/agents/index.ts`);

    const indexPath = path.join(`${config.dirPath}/agents`, 'index.ts');

    if (!fs.access(indexPath)) {
      await fs.writeFile(indexPath, '// Mastra Agents\n\n');
    }

    const content = await fs.readFile(indexPath);

    if (!content.length) {
      await fs.writeFile(indexPath, `import { Agent } from '@mastra/core'\n\n\n`);
    }

    await fs.appendFile(indexPath, formattedAgent);

    logger.break();
    logger.success(`✓ Agent: ${toCamelCase(answers.name)} created successfully!\n`);

    return toCamelCase(answers.name);
  } catch (error) {
    if (error instanceof ExecaError) {
      if (error.isCanceled) {
        logger.warn('Operation cancelled\n');
        process.exit(0);
      }
    } else if (error instanceof Error && error.name === 'ExitPromptError') {
      logger.warn('\nPrompt cancelled');
      process.exit(0);
    } else if (error instanceof Error) {
      logger.error(`Error creating agent: ${error.message}`);
    } else {
      logger.error(`Error creating agent: ${error}`);
    }

    return false;
  }
}
