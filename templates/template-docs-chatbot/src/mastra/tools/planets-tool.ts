import { createTool } from '@mastra/core';
import { z } from 'zod';
import planetsData from '../../data/planets.json';

type PlanetOutput = {
  planet: {
    name: string;
    type: string;
    distanceFromSun: string;
    diameter: string;
    dayLength: string;
    yearLength: string;
    moons: number;
    atmosphere: string;
    temperature: string;
  };
  randomFact?: string;
  allPlanets?: string[];
};

export const planetsInfoTool = createTool({
  id: 'Get Planet Information',
  description: 'Get detailed information about planets in our solar system, including random facts',
  inputSchema: z.object({
    planet: z
      .string()
      .optional()
      .describe(
        'Name of the planet (mercury, venus, earth, mars, jupiter, saturn, uranus, neptune). If not provided, returns info about a random planet',
      ),
    includeRandomFact: z
      .boolean()
      .optional()
      .default(true)
      .describe('Whether to include a random fact about the planet'),
  }),

  execute: async ({ context }) => {
    const { planet, includeRandomFact } = context;

    // If no planet specified, pick a random one
    const planetKeys = Object.keys(planetsData);
    let selectedPlanet: string;

    if (planet) {
      selectedPlanet = planet.toLowerCase();
      if (!planetsData[selectedPlanet as keyof typeof planetsData]) {
        throw new Error(`Planet "${planet}" not found. Available planets: ${planetKeys.join(', ')}`);
      }
    } else {
      selectedPlanet = planetKeys[Math.floor(Math.random() * planetKeys.length)];
    }

    const planetInfo = planetsData[selectedPlanet as keyof typeof planetsData];

    const result: PlanetOutput = {
      planet: {
        name: planetInfo.name,
        type: planetInfo.type,
        distanceFromSun: planetInfo.distanceFromSun,
        diameter: planetInfo.diameter,
        dayLength: planetInfo.dayLength,
        yearLength: planetInfo.yearLength,
        moons: planetInfo.moons,
        atmosphere: planetInfo.atmosphere,
        temperature: planetInfo.temperature,
      },
    };

    if (includeRandomFact) {
      const randomFactIndex = Math.floor(Math.random() * planetInfo.facts.length);
      result.randomFact = planetInfo.facts[randomFactIndex];
    }

    // If no specific planet was requested, also return the list of all planets
    if (!planet) {
      result.allPlanets = planetKeys.map(key => planetsData[key as keyof typeof planetsData].name);
    }

    return result;
  },
});
