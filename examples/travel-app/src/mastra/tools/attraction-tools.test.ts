import { beforeEach, describe, it, expect } from '@jest/globals';

import { mastra } from '../index';

describe('Attraction Tools', () => {
  let searchAttractionsTool: any;

  beforeEach(() => {
    searchAttractionsTool = mastra.getTool('searchAttractions');
  });

  it('should search for attractions in a city', async () => {
    const result = await searchAttractionsTool.execute({
      destination: '20144883',
    });

    expect(result).toBeDefined();
    expect(Array.isArray(result.attractions)).toBe(true);
    expect(result.attractions.length).toBeGreaterThan(0);

    // Test the structure of an attraction result
    const attraction = result.attractions[0];
    expect(attraction).toHaveProperty('id');
    expect(attraction).toHaveProperty('name');
    expect(attraction).toHaveProperty('location');
    expect(attraction).toHaveProperty('imageUrl');
    expect(attraction).toHaveProperty('description');
    expect(attraction).toHaveProperty('price');

    // Test data types of properties
    expect(typeof attraction.id).toBe('string');
    expect(typeof attraction.name).toBe('string');
    expect(typeof attraction.location).toBe('string');
    expect(typeof attraction.imageUrl).toBe('string');
    expect(typeof attraction.description).toBe('string');
    expect(typeof attraction.price).toBe('number');
  }, 15000); // Set timeout to 15 seconds like in flight tests
});