export const formatScheduleTimestamp = (ms?: number) => {
  if (!ms || ms <= 0) return '—';
  return new Date(ms).toLocaleString();
};

export const formatRelativeTime = (ms?: number) => {
  if (!ms || ms <= 0) return '—';
  const diff = ms - Date.now();
  const abs = Math.abs(diff);
  const seconds = Math.floor(abs / 1000);
  if (seconds < 60) return diff >= 0 ? `in ${seconds}s` : `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return diff >= 0 ? `in ${minutes}m` : `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return diff >= 0 ? `in ${hours}h` : `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return diff >= 0 ? `in ${days}d` : `${days}d ago`;
};
