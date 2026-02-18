import { NoticeRoot } from './notice-root';
import { NoticeMessage } from './notice-message';
import { NoticeButton } from './notice-button';
import { NoticeTitle } from './notice-title';
import { NoticeColumn } from './notice-column';

export { type NoticeVariant, type NoticeRootProps } from './notice-root';
export { type NoticeMessageProps } from './notice-message';

export const Notice = Object.assign(NoticeRoot, {
  Message: NoticeMessage,
  Button: NoticeButton,
  Title: NoticeTitle,
  Column: NoticeColumn,
});
