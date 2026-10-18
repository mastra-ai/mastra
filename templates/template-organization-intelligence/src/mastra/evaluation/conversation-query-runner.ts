import { parseArgs } from 'node:util';
import { createQueryContextualizer } from '../agents/query-contextualizer.js';
import { evaluateConversationQueries } from './conversation-queries.js';

const args = process.argv.slice(2);
if (args[0] === '--') args.shift();
const { values } = parseArgs({
  args,
  options: { 'allow-live': { type: 'boolean' } },
  strict: true,
  allowPositionals: false,
});
if (!values['allow-live']) throw new Error('Pass --allow-live to run seven paid synthetic contextualization cases.');
if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is required for live contextualization evaluation.');
const report = await evaluateConversationQueries(createQueryContextualizer('openai/gpt-5.6-terra'));
process.stdout.write(JSON.stringify(report, null, 2) + '\n');
if (!report.passed) process.exitCode = 1;
