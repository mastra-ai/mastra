import { access, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { WorkflowsLibSQL } from '@mastra/libsql';

// Let the actual storage claim finish, then hold the first request at the server's resume boundary.
const update = WorkflowsLibSQL.prototype.updateWorkflowState;
WorkflowsLibSQL.prototype.updateWorkflowState = async function (input) {
  const result = await update.call(this, input);
  if (!result || input.workflowName !== 'review' || input.opts.expectedStatus !== 'suspended') return result;
  const gate = join(dirname(process.env.SUPPORT_CREDENTIALS_FILE), `resume-${input.runId}`);
  try {
    await access(gate);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    return result;
  }
  await writeFile(`${gate}.claimed`, '');
  for (let attempt = 0; attempt < 400; attempt++) {
    try {
      await access(`${gate}.release`);
      return result;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      await delay(25);
    }
  }
  throw new Error('Timed out waiting to release the claimed review');
};
