import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// This example expects a single-column CSV with an 'amount' header.
export function summarize(csv) {
  // Split the file into lines and skip the header.
  const rows = csv.trim().split(/\r?\n/).slice(1);
  // Ignore empty lines and convert each amount to a number.
  const amounts = rows.filter(Boolean).map(Number);
  return {
    // Intentional bug: slice(0, -1) drops the last amount before summing.
    total: amounts.slice(0, -1).reduce((sum, value) => sum + value, 0),
    row_count: amounts.length,
  };
}

// Run the CLI only when this file is executed directly, not imported by tests.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  // Read the CSV path from the command line and print the summary as JSON.
  console.log(JSON.stringify(summarize(readFileSync(process.argv[2], 'utf8'))));
}
