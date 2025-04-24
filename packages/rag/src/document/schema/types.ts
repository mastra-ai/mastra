import { randomUUID } from 'crypto';
import type { BaseNode } from './node';

interface TransformComponentSignature<Result extends BaseNode[] | Promise<BaseNode[]>> {
  <Options extends Record<string, unknown>>(nodes: BaseNode[], options?: Options): Result;
}

export interface TransformComponent<Result extends BaseNode[] | Promise<BaseNode[]> = BaseNode[] | Promise<BaseNode[]>>
  extends TransformComponentSignature<Result> {
  id: string;
}

export class TransformComponent<Result extends BaseNode[] | Promise<BaseNode[]> = BaseNode[] | Promise<BaseNode[]>> {
  constructor(transformFn: TransformComponentSignature<Result>) {
    Object.defineProperties(transformFn, Object.getOwnPropertyDescriptors(this.constructor.prototype));
    const transform = function transform(...args: Parameters<TransformComponentSignature<Result>>) {
      return transformFn(...args);
    };
    Reflect.setPrototypeOf(transform, new.target.prototype);
    transform.id = randomUUID();
    return transform;
  }
}

/**
 * An OutputParser is used to extract structured data from the raw output of the LLM.
 */

export interface BaseOutputParser<T = any> {
  parse(output: string): T;

  format(output: string): string;
}
