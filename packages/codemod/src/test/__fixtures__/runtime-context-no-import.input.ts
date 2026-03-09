// @ts-nocheck

// User-defined RuntimeContext class (NOT from Mastra)
class RuntimeContext {
  constructor(public value: string) {}
}

const context = new RuntimeContext('custom');

// This should NOT be renamed since RuntimeContext is not from Mastra
const runtimeContext = { foo: 'bar' };
console.log(runtimeContext);
