import { beforeEach, describe, it, expect, jest } from '@jest/globals';
import { Mastra } from '../mastra';
import { createTool } from '..';
import { z } from 'zod';

const mockFindUser = jest.fn().mockImplementation(async (data) => {
  const list = [
    { name: 'Dero Israel', email: 'dero@mail.com' },
    { name: 'Ife Dayo', email: 'dayo@mail.com' },
    { name: 'Tao Feeq', email: 'feeq@mail.com' },
  ];

  const userInfo = list?.find(
    ({ name }) => name === (data as { name: string }).name
  );
  if (!userInfo) return { message: 'User not found' };
  return userInfo;
});

describe('createTool', () => {
  let mastra: any;

  const testTool = createTool({
    label: 'Test tool',
    description: 'This is a test tool that returns the name and email',
    schema: z.object({
      name: z.string(),
    }),
    executor: ({ data }) => {
      return mockFindUser(data) as Promise<Record<string, any>>;
    },
  });

  beforeEach(() => {
    mastra = new Mastra({
      tools: {
        testTool,
      },
    });
  });

  it('should call mockFindUser', async () => {
    const userTool = mastra.getTool('testTool');

    await userTool.execute({ name: 'Dero Israel' });

    expect(mockFindUser).toHaveBeenCalledTimes(1);
    expect(mockFindUser).toHaveBeenCalledWith({ name: 'Dero Israel' });
  });

  it("should return an object containing 'Dero Israel' as name and 'dero@mail.com' as email", async () => {
    const userTool = mastra.getTool('testTool');

    const user = await userTool.execute({ name: 'Dero Israel' });

    expect(user).toStrictEqual({ name: 'Dero Israel', email: 'dero@mail.com' });
  });

  it("should return an object containing 'User not found' message", async () => {
    const userTool = mastra.getTool('testTool');

    const user = await userTool.execute({ name: 'Taofeeq Oluderu' });

    expect(user).toStrictEqual({ message: 'User not found' });
  });
});
