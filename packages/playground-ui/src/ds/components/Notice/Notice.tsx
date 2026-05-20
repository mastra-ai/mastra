import { NoticeButton } from './notice-button';
import { NoticeMessage } from './notice-message';
import { NoticeRoot } from './notice-root';

export { type NoticeVariant, type NoticeRootProps } from './notice-root';
export { type NoticeMessageProps } from './notice-message';

export const Notice = Object.assign(NoticeRoot, {
  Message: NoticeMessage,
  Button: NoticeButton,
});
