module.exports = {
  displayName: 'cli',
  testEnvironment: 'node',
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
  },
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  testPathIgnorePatterns: ['admin'],
  preset: 'ts-jest/presets/default-esm', // Ensure ESM preset is applied
};
