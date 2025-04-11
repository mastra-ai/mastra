import { describe, expect, it } from 'vitest';
import { helloTool } from '../hello';

describe('hello tool', () => {
  it('should return a default greeting when no name is provided', async () => {
    const result = await helloTool.execute({});
    expect(result.content[0].text).toBe('Hello, World! Welcome to the Registry Registry service.');
  });

  it('should return a personalized greeting when a name is provided', async () => {
    const result = await helloTool.execute({ name: 'Mastra' });
    expect(result.content[0].text).toBe('Hello, Mastra! Welcome to the Registry Registry service.');
  });
});
