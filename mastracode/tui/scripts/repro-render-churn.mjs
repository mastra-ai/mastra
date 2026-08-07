import { Container, Text } from '@earendil-works/pi-tui';

const args = process.argv.slice(2).filter(argument => argument !== '--');
const childCount = parsePositiveInteger(args[0] ?? '5000', 'childCount');
const renders = parsePositiveInteger(args[1] ?? '30000', 'renders');
const payloadBytes = parsePositiveInteger(args[2] ?? '2000', 'payloadBytes');
const width = parsePositiveInteger(args[3] ?? '120', 'width');

const container = new Container();
const payload = 'x'.repeat(payloadBytes);
for (let index = 0; index < childCount; index++) {
  container.addChild(new Text(`${index}: ${payload}`, 0, 0));
}

globalThis.gc?.();
const before = process.memoryUsage();
const startedAt = performance.now();
let renderedBytes = 0;

for (let index = 0; index < renders; index++) {
  const lines = container.render(width);
  for (const line of lines) {
    renderedBytes += Buffer.byteLength(line);
  }
}

globalThis.gc?.();
const elapsedMs = performance.now() - startedAt;
const after = process.memoryUsage();
const usage = process.resourceUsage();

console.log(
  JSON.stringify(
    {
      childCount,
      renders,
      payloadBytes,
      width,
      elapsedMs: Math.round(elapsedMs),
      renderedGiB: toGiB(renderedBytes),
      beforeRssMiB: toMiB(before.rss),
      afterRssMiB: toMiB(after.rss),
      afterHeapUsedMiB: toMiB(after.heapUsed),
      maxRssMiB: Number((usage.maxRSS / 1024).toFixed(1)),
    },
    null,
    2,
  ),
);

function parsePositiveInteger(value, name) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer, received: ${value}`);
  }
  return parsed;
}

function toMiB(bytes) {
  return Number((bytes / 1024 ** 2).toFixed(1));
}

function toGiB(bytes) {
  return Number((bytes / 1024 ** 3).toFixed(2));
}
