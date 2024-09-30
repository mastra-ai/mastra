import { z } from 'zod';
import { getResponseDataKey, allowedKey, getEntityKey } from './sync-factory';
import {
  getPricesResponseSchema,
  getPricesPriceResponseSchema,
} from './sync-fixtures/stripe';
import {
  reposGetResponseSchema,
  reposListForOrgResponseSchema,
} from './sync-fixtures/github';

describe('Factory', () => {
  describe('STRIPE', () => {
    it('should fields for multi data', () => {
      getResponseDataKey({
        listDataKey: `data`,
        responseSchema: getPricesResponseSchema,
      });
    });

    it('should fields for single data', () => {
      getResponseDataKey({
        listDataKey: `data`,
        responseSchema: getPricesPriceResponseSchema,
      });
    });
  });

  describe('GITHUB', () => {
    it('should fields for multi data', () => {
      const props = getResponseDataKey({
        responseSchema: reposListForOrgResponseSchema,
      });
      console.log(props);
    });

    it('should fields for single data', () => {
      getResponseDataKey({ responseSchema: reposGetResponseSchema });
    });
  });

  it('allowedKey', () => {
    expect(allowedKey('getPrices')).toBe(true);
    expect(allowedKey('reposListForOrg')).toBe(true);
    expect(allowedKey('reposGet')).toBe(true);
    expect(allowedKey('reposUpdate')).toBe(false);
    expect(allowedKey('calendarEventsGet')).toBe(true);
    expect(allowedKey('calendarEventsList')).toBe(true);
  });

  it.only('entityKey', () => {
    expect(getEntityKey('getPrices')).toBe('prices');
    expect(getEntityKey('getPricesPrice')).toBe('prices');
    expect(getEntityKey('getProducts')).toBe('products');
    expect(getEntityKey('getProductsProduct')).toBe('products');
    expect(getEntityKey('reposList')).toBe('repos');
    expect(getEntityKey('reposGet')).toBe('repos');
    expect(getEntityKey('calendarEventsGet')).toBe('calendar');
    expect(getEntityKey('calendarCalendarListList')).toBe('calendar');
  });
});
