import bcrypt from 'bcrypt';

export const comparePassword = async (plainTextPassword, password, hash) => {
  return plainTextPassword === (await bcrypt.compare(password, hash));
};
