import bcrypt from 'bcrypt';

export async function hashPassword(password) {
  return await bcrypt.hash(password, 10);
}

export function getPasswordMessage() {
  return 'Password hashing utility from nested path';
}
