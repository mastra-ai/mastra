import { MDocument } from './dist/index.js';

const text =
  'A dynamic concert scene captures an energetic, vibrant atmosphere, with a densely packed crowd silhouetted against bright stage lights. The image features beams of white light radiating from multiple projectors, creating dramatic patterns across a darkened room. The audience, comprised of numerous people with raised hands, exudes excitement and engagement, enhancing the lively mood. The setting suggests a large indoor venue, possibly a music or worship event, with text visible on a screen in the background, adding to an immersive experience. The overall composition emphasizes a sense of community and shared enthusiasm, ideal for promoting entertainment events, live concerts, or communal gatherings. The high-contrast lighting and slight haze effect imbue the scene with a modern, electrifying quality.';

const expectedOutput = [
  'A dynamic concert scene captures an energetic, vibrant atmosphere, with a densely packed crowd silhouetted against bright stage lights. The image features beams of white light radiating from multiple projectors, creating dramatic patterns across a darkened room.',
  'The audience, comprised of numerous people with raised hands, exudes excitement and engagement, enhancing the lively mood. The setting suggests a large indoor venue, possibly a music or worship event, with text visible on a screen in the background, adding to an immersive experience.',
  'The overall composition emphasizes a sense of community and shared enthusiasm, ideal for promoting entertainment events, live concerts, or communal gatherings. The high-contrast lighting and slight haze effect imbue the scene with a modern, electrifying quality.',
];

console.log("🧪 Testing Original User's Example\n");
console.log('📝 Input text length:', text.length, 'characters');
console.log('🎯 Expected output: 3 chunks preserving sentence structure\n');

console.log("1️⃣ ORIGINAL CHARACTER STRATEGY (user's original attempt):");
console.log("   strategy: 'character', separator: '.', minSize: 50, maxSize: 450, overlap: 0, keepSeparator: true\n");

try {
  const doc1 = MDocument.fromText(text);
  const chunks1 = await doc1.chunk({
    strategy: 'character',
    separator: '.',
    size: 450,
    overlap: 0,
    keepSeparator: true,
  });

  console.log('   ✅ Result: Got', chunks1.length, 'chunks');
  chunks1.forEach((chunk, i) => {
    console.log(`   Chunk ${i + 1} (${chunk.text.length} chars): "${chunk.text}"`);
  });

  console.log('\n   📊 Analysis:');
  console.log('   - Matches expected chunk count?', chunks1.length === 3 ? '✅ YES' : '❌ NO');
  console.log(
    '   - Preserves sentence structure?',
    chunks1.every(chunk => chunk.text.endsWith('.')) ? '✅ YES' : '❌ NO',
  );
} catch (error) {
  console.log('   ❌ Error:', error.message);
}

console.log('\n' + '='.repeat(80) + '\n');

console.log('2️⃣ NEW SENTENCE STRATEGY (default settings):');
console.log(
  "   strategy: 'sentence', minSize: 50, maxSize: 450, overlap: 0, sentenceEnders: ['.'], keepSeparator: true\n",
);

try {
  const doc2 = MDocument.fromText(text);
  const chunks2 = await doc2.chunk({
    strategy: 'sentence',
    minSize: 50,
    maxSize: 450,
    overlap: 0,
    sentenceEnders: ['.'],
    keepSeparator: true,
  });

  console.log('   ✅ Result: Got', chunks2.length, 'chunks');
  chunks2.forEach((chunk, i) => {
    console.log(`   Chunk ${i + 1} (${chunk.text.length} chars): "${chunk.text}"`);
  });

  console.log('\n   📊 Analysis:');
  console.log('   - Matches expected chunk count?', chunks2.length === 3 ? '✅ YES' : '❌ NO');
  console.log(
    '   - Preserves sentence structure?',
    chunks2.every(chunk => chunk.text.endsWith('.')) ? '✅ YES' : '❌ NO',
  );
  console.log(
    '   - All chunks within size limits?',
    chunks2.every(chunk => chunk.text.length >= 50 && chunk.text.length <= 450) ? '✅ YES' : '❌ NO',
  );
} catch (error) {
  console.log('   ❌ Error:', error.message);
}

console.log('\n' + '='.repeat(80) + '\n');

console.log('3️⃣ TUNED SENTENCE STRATEGY (targeting 3 chunks):');
console.log(
  "   strategy: 'sentence', minSize: 50, maxSize: 350, targetSize: 250, overlap: 0, sentenceEnders: ['.'], keepSeparator: true\n",
);

try {
  const doc3 = MDocument.fromText(text);
  const chunks3 = await doc3.chunk({
    strategy: 'sentence',
    minSize: 50,
    maxSize: 350,
    targetSize: 250,
    overlap: 0,
    sentenceEnders: ['.'],
    keepSeparator: true,
  });

  console.log('   ✅ Result: Got', chunks3.length, 'chunks');
  chunks3.forEach((chunk, i) => {
    console.log(`   Chunk ${i + 1} (${chunk.text.length} chars): "${chunk.text}"`);
  });

  console.log('\n   📊 Analysis:');
  console.log('   - Matches expected chunk count?', chunks3.length === 3 ? '✅ YES' : '❌ NO');
  console.log(
    '   - Preserves sentence structure?',
    chunks3.every(chunk => chunk.text.endsWith('.')) ? '✅ YES' : '❌ NO',
  );
  console.log(
    '   - All chunks within size limits?',
    chunks3.every(chunk => chunk.text.length >= 50 && chunk.text.length <= 350) ? '✅ YES' : '❌ NO',
  );

  console.log('\n   🎯 Comparison with expected output:');
  let exactMatch = true;
  for (let i = 0; i < Math.max(chunks3.length, expectedOutput.length); i++) {
    const actual = chunks3[i]?.text || '';
    const expected = expectedOutput[i] || '';
    const matches = actual === expected;
    exactMatch = exactMatch && matches;
    console.log(`   Chunk ${i + 1}: ${matches ? '✅ EXACT MATCH' : '❌ DIFFERENT'}`);
    if (!matches && actual && expected) {
      console.log(`     Expected length: ${expected.length} chars`);
      console.log(`     Actual length:   ${actual.length} chars`);
    }
  }
  console.log(`   Overall match: ${exactMatch ? '✅ PERFECT' : '❌ CLOSE BUT DIFFERENT'}`);
} catch (error) {
  console.log('   ❌ Error:', error.message);
}

console.log('\n' + '='.repeat(80) + '\n');
console.log('🏁 Test Complete!');
