import { DomainError } from '../domain/errors.js';

export function assertSingleTarget(target: string): void {
  if (
    ['*', '?', ',', '[', ']', '{', '}'].some(value => target.includes(value)) ||
    /^(all|any|bulk)(?:$|[-_:])/iu.test(target)
  )
    throw new DomainError('VALIDATION_FAILED');
}
