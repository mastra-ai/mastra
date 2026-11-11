export class PublisherQueueLimitError extends Error {
  constructor(
    message = 'UnixSocketPubSub publisher queue limit exceeded',
    readonly waitForCapacity?: () => Promise<void>,
  ) {
    super(message);
  }
}
