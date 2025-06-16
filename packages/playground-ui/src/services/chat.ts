import { AbstractChat, ChatState, ChatStatus, UIMessage } from 'ai';

export class MastraChat extends AbstractChat<any> {}

export class MastraChatState implements ChatState<any> {
  status: ChatStatus = 'ready';
  error: Error | undefined;
  messages: UIMessage<any, any>[] = [];
  popMessage() {}
  replaceMessage(_index: number, _message: UIMessage<any, any>) {
    console.log({ _index, _message });
  }
  snapshot = <T>(value: T): T => structuredClone(value);
  pushMessage(_message: UIMessage<any, any>) {
    console.log(_message);
  }
}
