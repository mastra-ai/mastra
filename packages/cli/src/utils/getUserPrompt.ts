import prompt from 'prompt';

export async function getUserPrompt() {
  prompt.start();
  const { userInputDbUrl } = await prompt.get({
    properties: {
      userInputDbUrl: {
        description:
          'Enter your PostgreSQL connection string (postgresql://username:password@host:port/database) or press Enter to create a new instance:',
        type: 'string',
        pattern: /^(postgresql:\/\/.*|)$/,
        message: 'Please enter a valid PostgreSQL connection string or leave blank',
        required: false,
      },
    },
  });

  return { userInputDbUrl };
}
