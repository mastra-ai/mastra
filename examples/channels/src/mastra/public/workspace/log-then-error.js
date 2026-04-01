const prefix = process.argv[2] ? `${process.argv[2]} ` : '';

let count = 0;
const intervalMs = 1000;
const maxLogs = 3;

const interval = setInterval(() => {
  count += 1;
  console.log(`${prefix}log ${count}`);

  if (count >= maxLogs) {
    clearInterval(interval);

    setTimeout(() => {
      JSON.parse('{ this is not valid JSON }');
    }, 250);
  }
}, intervalMs);
