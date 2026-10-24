/** Keep arbitrary-precision insurance amounts out of floating-point arithmetic. */
export function normalizeDecimal(value: string): string {
  const negative = value.startsWith('-');
  const [integer, fraction = ''] = (negative ? value.slice(1) : value).split('.');
  const trimmed = fraction.replace(/0+$/, '');
  const magnitude = `${integer}${trimmed ? `.${trimmed}` : ''}`;
  return negative && magnitude !== '0' ? `-${magnitude}` : magnitude;
}

export function compareDecimals(left: string, right: string): number {
  const scale = Math.max(left.split('.')[1]?.length ?? 0, right.split('.')[1]?.length ?? 0);
  const integer = (value: string) => {
    const [whole, fraction = ''] = value.split('.');
    return BigInt(`${whole}${fraction.padEnd(scale, '0')}`);
  };
  const difference = integer(left) - integer(right);
  return difference < 0n ? -1 : difference > 0n ? 1 : 0;
}
