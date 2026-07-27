import { transformAsync } from '@babel/core';
import { removeNonReferencedNodes } from '../babel/remove-non-referenced-nodes';

export async function recursiveRemoveNonReferencedNodes(code: string): Promise<{ code: string; map: any }> {
  const result = await transformAsync(code, {
    babelrc: false,
    configFile: false,
    plugins: [removeNonReferencedNodes],
  });

  // keep looping until the code is not changed
  if (result && result.code! !== code) {
    return recursiveRemoveNonReferencedNodes(result!.code!);
  }

  return {
    code: result!.code!,
    map: result!.map!,
  };
}
