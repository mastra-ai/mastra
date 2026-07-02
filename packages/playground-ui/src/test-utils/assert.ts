export function assertDefined<T>(value: T, message = 'Expected value to be defined'): NonNullable<T> {
  if (value == null) throw new Error(message);
  return value;
}
