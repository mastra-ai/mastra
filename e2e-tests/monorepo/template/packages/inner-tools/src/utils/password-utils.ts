export async function hashPassword(password: string): Promise<string> {
  // Simple hash function for testing (not for production use)
  return `hashed_${password}`;
}

export function getPasswordMessage(): string {
  return 'Password hashing utility from nested path';
}
