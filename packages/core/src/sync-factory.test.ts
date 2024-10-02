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
    expect(allowedKey('getApiUsagePlansV2')).toBe(true);
    expect(allowedKey('listDatasets')).toBe(true);
    expect(allowedKey('getDataset')).toBe(true);
    expect(allowedKey('getExamples')).toBe(true);
    expect(allowedKey('getTrainedModels')).toBe(true);
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
    expect(getEntityKey('getApiUsagePlansV2')).toBe('apiusageplansv2');
    expect(getEntityKey('listDatasets')).toBe('datasets');
    expect(getEntityKey('getDataset')).toBe('datasets');
    expect(getEntityKey('getExamples')).toBe('examples');
    expect(getEntityKey('getTrainedModels')).toBe('trainedmodels');
  });
});
