import type { ScrollOptions } from '../../types';

const immediate = {
  passive: false,
} as const;
const delayed = {
  passive: true,
} as const;

export default (options: ScrollOptions) =>
  options.shouldPublishImmediately ? immediate : delayed;
