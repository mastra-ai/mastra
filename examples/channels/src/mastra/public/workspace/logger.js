const prefix = process.argv[2] ? `${process.argv[2]} ` : '';

let count = 0;
const intervalMs = 2000;
const maxRuns = 5;

const interval = setInterval(() => {
  count += 1;
  const timestamp = new Date().toISOString();
  console.log(`${timestamp} ${prefix}message ${count}`);

  if (count >= maxRuns) {
    clearInterval(interval);
  }
}, intervalMs);
