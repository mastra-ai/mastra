import bcrypt from 'bcrypt';

export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, 10);
}

export function getPasswordMessage(): string {
  return 'Password hashing utility from nested path';
}
