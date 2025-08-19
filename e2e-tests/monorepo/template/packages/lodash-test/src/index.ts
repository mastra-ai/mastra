import { get } from 'lodash/fp';

export const IgetYouAnything = (obj: any, key: string) => {
  return get(key, obj);
};
