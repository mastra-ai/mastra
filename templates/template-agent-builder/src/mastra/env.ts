export const getEnv = (name: string) => process.env[name]?.trim();

export const hasEnv = (name: string) => Boolean(getEnv(name));

export const requiredEnv = (name: string) => {
  const value = getEnv(name);

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}. Add it to .env before starting.`);
  }

  return value;
};

export const requireEnterpriseLicense = () => {
  const license = requiredEnv('MASTRA_EE_LICENSE');

  if (license.length < 32) {
    throw new Error(
      'Agent Builder requires a valid MASTRA_EE_LICENSE with at least 32 characters. Add it to .env before starting.',
    );
  }

  return license;
};
