import { createTool } from '@mastra/core/tools';
import bcrypt from 'bcrypt';
import { comparePassword } from '@inner/native-binding-package';
import { IgetYouAnything } from '@inner/lodash';
import { hashPassword, getPasswordMessage } from '~/utils/password-utils';

export const helloWorldTool = createTool({
  id: 'inner-tool',
  description: 'A tool that returns hello world',
  execute: async () => 'Hello, world!',
});

export const toolUsingNativeBindings = createTool({
  id: 'generate-password',
  description: 'A tool that generates a password',
  execute: async context => {
    const password = await hashPassword(context.plainTextPassword);
    return `${getPasswordMessage()}: ${password}`;
  },
});

export const toolWithNativeBindingPackageDep = createTool({
  id: 'compare-password',
  description: 'A tool that compares a password',
  execute: async () => {
    const password = await comparePassword(`password`, `password`, 10);
    return IgetYouAnything(
      {
        password,
      },
      'password',
    );
  },
});
