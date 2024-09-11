import { IntegrationFieldTypeEnum } from '@kpl/core';
import { z } from 'zod';

export const CREATE_POST_SCHEMA = z.object({
  post: z.string().describe(`type::${IntegrationFieldTypeEnum.LONG_TEXT}`),
});

export const CREATE_POST_OUTPUT_SCHEMA = z.object({
  post: z.string().describe(`type::${IntegrationFieldTypeEnum.LONG_TEXT}`),
  id: z.string(),
  postUrl: z.string().url(),
});
