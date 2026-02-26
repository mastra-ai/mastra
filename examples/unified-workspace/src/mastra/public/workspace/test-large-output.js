// Test script that produces output exceeding the default 3k token limit.
// Run with: node test-large-output.js
// The workspace execute_command tool should truncate this using sandwich mode
// (keeping first ~10% + last ~90% of the token budget).

// Section 1: Simulated build log (first ~50 lines)
console.log('=== BUILD STARTED ===');
console.log('Resolving dependencies...');
for (let i = 1; i <= 50; i++) {
  console.log(`[build] Compiling module ${i}/500: src/modules/module-${String(i).padStart(3, '0')}.ts (${Math.floor(Math.random() * 500 + 100)} bytes)`);
}

// Section 2: Large middle section (this should get truncated)
console.log('');
console.log('=== PROCESSING FILES ===');
for (let i = 51; i <= 450; i++) {
  const status = Math.random() > 0.05 ? 'ok' : 'warning';
  const time = (Math.random() * 100).toFixed(1);
  console.log(`[${status}] Processing file ${i}/500: src/modules/module-${String(i).padStart(3, '0')}.ts - transform: ${time}ms - bundle: ${(Math.random() * 50).toFixed(1)}ms`);
}

// Section 3: Warnings and errors (near the end, should be visible)
console.log('');
console.log('=== WARNINGS ===');
for (let i = 1; i <= 20; i++) {
  console.log(`Warning ${i}: Unused variable "temp${i}" in src/modules/module-${String(Math.floor(Math.random() * 500)).padStart(3, '0')}.ts:${Math.floor(Math.random() * 200)}`);
}

// Section 4: Final summary (at the very end, should always be visible)
console.log('');
console.log('=== BUILD COMPLETE ===');
console.log('Modules compiled: 500');
console.log('Warnings: 20');
console.log('Errors: 0');
console.log('Total time: 4.7s');
console.log('Output: dist/bundle.js (1.2 MB)');
console.log('Done.');
