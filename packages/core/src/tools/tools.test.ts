import { describe, it, expect, jest } from '@jest/globals';
import { z } from 'zod';

import { createTool } from '.';

const mockFindUser = jest.fn().mockImplementation(async data => {
  const list = [
    { name: 'Dero Israel', email: 'dero@mail.com' },
    { name: 'Ife Dayo', email: 'dayo@mail.com' },
    { name: 'Tao Feeq', email: 'feeq@mail.com' },
  ];

  const userInfo = list?.find(({ name }) => name === (data as { name: string }).name);
  if (!userInfo) return { message: 'User not found' };
  return userInfo;
});

describe('createTool', () => {
  const testTool = createTool({
    id: 'Test tool',
    description: 'This is a test tool that returns the name and email',
    inputSchema: z.object({
      name: z.string(),
    }),
    execute: ({ context }) => {
      return mockFindUser(context) as Promise<Record<string, any>>;
    },
  });

  it('should call mockFindUser', async () => {
    await testTool.execute({ context: { payload: { name: 'Dero Israel' } } });

    expect(mockFindUser).toHaveBeenCalledTimes(1);
    expect(mockFindUser).toHaveBeenCalledWith({ name: 'Dero Israel' });
  });

  it("should return an object containing 'Dero Israel' as name and 'dero@mail.com' as email", async () => {
    const user = await testTool.execute({ context: { payload: { name: 'Dero Israel' } } });

    expect(user).toStrictEqual({ name: 'Dero Israel', email: 'dero@mail.com' });
  });

  it("should return an object containing 'User not found' message", async () => {
    const user = await testTool.execute({ context: { payload: { name: 'Taofeeq Oluderu' } } });
    expect(user).toStrictEqual({ message: 'User not found' });
  });
});
