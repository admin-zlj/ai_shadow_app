import Redis from 'ioredis';

/**
 * Redis 连接客户端（单例）
 *
 * 连接配置：47.98.150.145:6381
 */
let redisClient: Redis | null = null;

export function getRedis(): Redis {
  if (!redisClient) {
    redisClient = new Redis({
      host: '47.98.150.145',
      port: 6389,
      password: 'redis-ai-shadow-dev',
      maxRetriesPerRequest: 3,
    });

    redisClient.on('error', (err) => {
      console.error('[Redis] connection error:', err.message);
    });

    redisClient.on('connect', () => {
      console.log('[Redis] connected');
    });
  }

  return redisClient;
}
