import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const vercelJsonPath = join(__dirname, "..", "vercel.json");
const vercelConfig = JSON.parse(readFileSync(vercelJsonPath, "utf-8"));

const redirects = vercelConfig.redirects || [];

let hasErrors = false;

// Check 1: Find redirects where source equals destination
console.log("=== Checking for same source and destination ===\n");

const sameSourceDest = redirects.filter((r) => r.source === r.destination);

if (sameSourceDest.length > 0) {
  hasErrors = true;
  console.log("Found redirects with identical source and destination:");
  sameSourceDest.forEach((r) => {
    console.log(`  - ${r.source}`);
  });
  console.log("");
} else {
  console.log("No redirects with identical source and destination found.\n");
}

// Check 2: Find redirect chains/loops
console.log("=== Checking for redirect chains ===\n");

// Build a map of source -> destination
const redirectMap = new Map();
redirects.forEach((r) => {
  redirectMap.set(r.source, r.destination);
});

// Find chains: where a destination is also a source of another redirect
const chains = [];

redirects.forEach((r) => {
  const visited = new Set();
  let current = r.source;
  const chain = [current];

  while (redirectMap.has(current)) {
    const next = redirectMap.get(current);

    // Skip external URLs (they can't be sources)
    if (next.startsWith("http://") || next.startsWith("https://")) {
      break;
    }

    if (visited.has(next)) {
      // Found a loop
      chain.push(next);
      chain.push("(LOOP)");
      break;
    }

    visited.add(current);
    current = next;
    chain.push(current);

    // If current is not a source, we've reached the end
    if (!redirectMap.has(current)) {
      break;
    }
  }

  // Only report chains with more than 2 steps (source -> dest -> dest2)
  if (chain.length > 2) {
    chains.push(chain);
  }
});

if (chains.length > 0) {
  hasErrors = true;
  console.log("Found redirect chains:");
  chains.forEach((chain) => {
    console.log(`  ${chain.join(" -> ")}`);
  });
  console.log("");
} else {
  console.log("No redirect chains found.\n");
}

// Summary
console.log("=== Summary ===\n");
console.log(`Total redirects: ${redirects.length}`);
console.log(`Redirects with same source/destination: ${sameSourceDest.length}`);
console.log(`Redirect chains: ${chains.length}`);

if (hasErrors) {
  console.log("\nErrors found! Please fix the issues above.");
  process.exit(1);
} else {
  console.log("\nAll checks passed!");
  process.exit(0);
}
