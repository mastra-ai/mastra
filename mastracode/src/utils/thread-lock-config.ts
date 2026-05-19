export type MastraCodeThreadLock = {
  acquire: (threadId: string) => Promise<void> | void;
  release: (threadId: string) => Promise<void> | void;
};

type ResolveMastraCodeThreadLockConfigOptions<TPubSub> = {
  pubsub?: TPubSub;
  crossProcessPubSub: boolean;
  acquireThreadLock: MastraCodeThreadLock['acquire'];
  releaseThreadLock: MastraCodeThreadLock['release'];
};

type MastraCodeThreadLockConfig<TPubSub> = {
  pubsub?: TPubSub;
  threadLock?: MastraCodeThreadLock;
};

export function resolveMastraCodeThreadLockConfig<TPubSub>({
  pubsub,
  crossProcessPubSub,
  acquireThreadLock,
  releaseThreadLock,
}: ResolveMastraCodeThreadLockConfigOptions<TPubSub>): MastraCodeThreadLockConfig<TPubSub> {
  if (crossProcessPubSub) {
    if (!pubsub) {
      throw new Error(
        'Invalid MastraCode configuration: crossProcessPubSub requires config.pubsub so thread locks are not disabled without shared signal routing.',
      );
    }
    return { pubsub, threadLock: undefined };
  }

  return {
    pubsub,
    threadLock: {
      acquire: acquireThreadLock,
      release: releaseThreadLock,
    },
  };
}
