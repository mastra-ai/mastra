import { parentPort, workerData } from 'node:worker_threads';
import { parseInput } from '../parsers/catalog.ts';
import { ParseFault } from '../parsers/contract.ts';
import { limitsSchema } from '../contracts/limits.ts';

try {
  const limits = limitsSchema.parse(workerData.limits);
  const result = await parseInput(workerData.bytes, workerData.format, workerData.mode, limits);
  parentPort?.postMessage({ result });
} catch (error) {
  parentPort?.postMessage({ code: error instanceof ParseFault ? error.code : 'PARSER_FAILED' });
}
