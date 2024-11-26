import { config } from 'dotenv';

config();

export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
      },
    ],
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '@mastra/core': '<rootDir>/../core/dist/index.js',
  },
  transformIgnorePatterns: ['node_modules/(?!(.*(@mastra/core))/)'],
};
