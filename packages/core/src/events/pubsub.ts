export abstract class PubSub {
  protected abstract publish(topic: string, event: Event): Promise<void>;
  protected abstract subscribe(topic: string, cb: (event: Event) => void): Promise<void>;
  protected abstract unsubscribe(topic: string, cb: (event: Event) => void): Promise<void>;
}
