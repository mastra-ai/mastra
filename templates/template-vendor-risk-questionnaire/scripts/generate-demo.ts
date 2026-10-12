import { prepareDemo } from './predev.ts';

const result = await prepareDemo();
console.log(`Originally authored fictional Northstar Tasks demo ${result}; existing data is preserved.`);
