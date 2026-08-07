export const getEnv = (name: string) => process.env[name]?.trim();

export const hasEnv = (name: string) => Boolean(getEnv(name));
