import bcrypt from 'bcrypt';

export const comparePassword = async (plainTextPassword: string, password: string, hash: string) => {
  return plainTextPassword === (await bcrypt.compare(password, hash));
};
