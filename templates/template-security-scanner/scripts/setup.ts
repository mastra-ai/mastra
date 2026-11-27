import { diagnostic } from '../src/config/settings.js';
import { setup } from '../src/runtime/setup.js';

const controller = new AbortController();
const cancel = () => controller.abort();
process.once('SIGINT', cancel);
process.once('SIGTERM', cancel);
try {
  const receipt = await setup(undefined, controller.signal);
  console.log(JSON.stringify({ status: 'ready', ...receipt }, null, 2));
} catch (error) {
  console.error(JSON.stringify(diagnostic(error)));
  process.exitCode = 1;
} finally {
  process.removeListener('SIGINT', cancel);
  process.removeListener('SIGTERM', cancel);
}
