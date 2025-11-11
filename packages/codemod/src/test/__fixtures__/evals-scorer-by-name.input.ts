// @ts-nocheck
import { Mastra } from '@mastra/core';

const mastra = new Mastra({
  // config
});

// Should transform - called on Mastra instance
const scorer = mastra.getScorerByName('helpfulness-scorer');

// Multiple calls
const scorer2 = mastra.getScorerByName('accuracy-scorer');

// Should NOT transform - called on other object
const otherObj = {
  getScorerByName: (name: string) => name
};
const other = otherObj.getScorerByName('should-not-change');

// Should NOT transform - not a Mastra instance
class MyClass {
  getScorerByName(name: string) {
    return name;
  }
}
const myInstance = new MyClass();
const result = myInstance.getScorerByName('also-should-not-change');