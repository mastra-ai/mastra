// Test script for ANSI color codes in terminal output.
// Run with: node test-ansi-colors.js

// Basic colors
console.log('\x1b[31mRed text\x1b[0m');
console.log('\x1b[32mGreen text\x1b[0m');
console.log('\x1b[33mYellow text\x1b[0m');
console.log('\x1b[34mBlue text\x1b[0m');
console.log('\x1b[35mMagenta text\x1b[0m');
console.log('\x1b[36mCyan text\x1b[0m');

// Bold + colors
console.log('\x1b[1m\x1b[31mBold Red\x1b[0m');
console.log('\x1b[1m\x1b[32mBold Green\x1b[0m');

// Background colors
console.log('\x1b[41m\x1b[37m White on Red \x1b[0m');
console.log('\x1b[42m\x1b[30m Black on Green \x1b[0m');
console.log('\x1b[44m\x1b[37m White on Blue \x1b[0m');

// 256-color mode
console.log('\x1b[38;5;196mBright Red (256)\x1b[0m');
console.log('\x1b[38;5;46mBright Green (256)\x1b[0m');
console.log('\x1b[38;5;21mBright Blue (256)\x1b[0m');
console.log('\x1b[38;5;208mOrange (256)\x1b[0m');

// RGB true color
console.log('\x1b[38;2;255;105;180mHot Pink (RGB)\x1b[0m');
console.log('\x1b[38;2;0;255;255mCyan (RGB)\x1b[0m');
console.log('\x1b[38;2;255;215;0mGold (RGB)\x1b[0m');

// Mixed formatting
console.log('\x1b[1m\x1b[4m\x1b[33mBold Underline Yellow\x1b[0m');
console.log('\x1b[2m\x1b[3mDim Italic\x1b[0m');
console.log('\x1b[9mStrikethrough\x1b[0m');

// Simulated build output
console.log('');
console.log('\x1b[1m\x1b[36m=== Build Output ===\x1b[0m');
console.log('\x1b[32m✓\x1b[0m Compiled \x1b[1msrc/index.ts\x1b[0m');
console.log('\x1b[32m✓\x1b[0m Compiled \x1b[1msrc/utils.ts\x1b[0m');
console.log('\x1b[33m⚠\x1b[0m Warning: Unused import in \x1b[4msrc/helpers.ts:12\x1b[0m');
console.log('\x1b[31m✗\x1b[0m Error: Type mismatch in \x1b[4msrc/api.ts:45\x1b[0m');
console.log('  \x1b[90mExpected: \x1b[32mstring\x1b[0m');
console.log('  \x1b[90mReceived: \x1b[31mnumber\x1b[0m');
console.log('');
console.log('\x1b[1mResult:\x1b[0m \x1b[31m1 error\x1b[0m, \x1b[33m1 warning\x1b[0m');

// Stderr test
console.error('\x1b[31m[ERROR]\x1b[0m This goes to stderr with \x1b[1mANSI codes\x1b[0m');
