export function parseVersion(version) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match) return undefined;
  return match.slice(1).map(Number);
}

export function atLeast(version, minimum) {
  for (let index = 0; index < minimum.length; index += 1) {
    if (version[index] !== minimum[index])
      return version[index] > minimum[index];
  }
  return true;
}

export function supportsNode(version) {
  const parsed = parseVersion(version);
  if (!parsed) return false;
  return (
    (parsed[0] === 22 && atLeast(parsed, [22, 22, 0])) ||
    (parsed[0] >= 24 && atLeast(parsed, [24, 15, 0]))
  );
}

export function supportsNpm(version) {
  const parsed = parseVersion(version);
  return Boolean(parsed && atLeast(parsed, [10, 9, 0]));
}
