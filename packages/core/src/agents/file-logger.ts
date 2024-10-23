import { Redis } from '@upstash/redis';

export async function getUpstashLogs({
  id,
  url,
  token,
}: {
  id: string;
  url: string;
  token: string;
}) {
  const redis = new Redis({
    url,
    token,
  });

  return redis.lrange(id, 0, -1);
}
