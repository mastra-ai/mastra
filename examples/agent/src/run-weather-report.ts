console.log('[1] starting');
import { weatherReportWorkflow } from './mastra/workflows/weather-report-workflow';
console.log('[2] imported workflow');

const run = await weatherReportWorkflow.createRun();
console.log('[3] created run');

const result = await run.start({ inputData: { location: 'Helsinki' } });
console.log('[4] finished run');

console.log(JSON.stringify(result, null, 2));

// Mastra leaves event-loop handles open (pubsub workers, etc.); force-exit so
// this one-shot demo script doesn't linger.
process.exit(result.status === 'success' ? 0 : 1);
