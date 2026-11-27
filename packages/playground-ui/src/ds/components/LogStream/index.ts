import { LogStreamFrame } from './log-stream-frame';
import { LogStreamHeader, LogStreamHeaderCell } from './log-stream-header';
import { LogStreamLine } from './log-stream-line';
import { LogStreamRoot } from './log-stream-root';
import { LogStreamRow, LogStreamRowButton } from './log-stream-row';
import { LogStreamSpacer } from './log-stream-spacer';

export const LogStream = Object.assign(LogStreamRoot, {
  Frame: LogStreamFrame,
  Header: LogStreamHeader,
  HeaderCell: LogStreamHeaderCell,
  Row: LogStreamRow,
  RowButton: LogStreamRowButton,
  Line: LogStreamLine,
  Spacer: LogStreamSpacer,
});

export type { LogStreamRootProps } from './log-stream-root';
export type { LogStreamFrameProps } from './log-stream-frame';
export type { LogStreamRowProps, LogStreamRowButtonProps } from './log-stream-row';
export type { LogStreamLineProps } from './log-stream-line';
export type { LogStreamIcon } from './log-stream-icon';
export type { LogStreamTimeProps } from './log-stream-time';
export { hasAnsi, parseAnsi, stripAnsi, type AnsiSegment } from './ansi';
export { logLevelDotClass, logLevelTextClass } from './log-level-styles';
export type { LogLevel } from './log-level-styles';
