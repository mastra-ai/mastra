import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock';

import { MastraLLM } from '../model';

export type AmazonModel =
  | 'amazon-titan-tg1-large'
  | 'amazon-titan-text-express-v1'
  | 'anthropic-claude-3-5-sonnet-20241022-v2:0'
  | 'anthropic-claude-3-5-sonnet-20240620-v1:0'
  | 'anthropic-claude-3-5-haiku-20241022-v1:0'
  | 'anthropic-claude-3-opus-20240229-v1:0'
  | 'anthropic-claude-3-sonnet-20240229-v1:0'
  | 'anthropic-claude-3-haiku-20240307-v1:0'
  | 'anthropic-claude-v2:1'
  | 'cohere-command-r-v1:0'
  | 'cohere-command-r-plus-v1:0'
  | 'meta-llama2-13b-chat-v1'
  | 'meta-llama2-70b-chat-v1'
  | 'meta-llama3-8b-instruct-v1:0'
  | 'meta-llama3-70b-instruct-v1:0'
  | 'meta-llama3-1-8b-instruct-v1:0'
  | 'meta-llama3-1-70b-instruct-v1:0'
  | 'meta-llama3-1-405b-instruct-v1:0'
  | 'meta-llama3-2-1b-instruct-v1:0'
  | 'meta-llama3-2-3b-instruct-v1:0'
  | 'meta-llama3-2-11b-instruct-v1:0'
  | 'meta-llama3-2-90b-instruct-v1:0'
  | 'mistral-mistral-7b-instruct-v0:2'
  | 'mistral-mixtral-8x7b-instruct-v0:1'
  | 'mistral-mistral-large-2402-v1:0'
  | 'mistral-mistral-small-2402-v1:0'
  | (string & {});

export class AmazonBedrock extends MastraLLM {
  constructor({
    name = 'amazon-titan-tg1-large',
    region = process.env.AWS_REGION || '',
    accessKeyId = process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY || '',
    sessionToken = process.env.AWS_SESSION_TOKEN || '',
  }: {
    name?: AmazonModel;
    region?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    sessionToken?: string;
  }) {
    const amazon = createAmazonBedrock({
      region,
      accessKeyId,
      secretAccessKey,
      sessionToken,
    });

    super({ model: amazon(name) });
  }
}
