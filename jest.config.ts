module.exports = {
  displayName: 'engine',
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
      },
    ],
  },
  projects: ['<rootDir>/packages/*/jest.config.ts'],
  maxWorkers: '50%',
  testTimeout: 30000,
  testPathIgnorePatterns: ['/node_modules/', '/integrations/', '/integrations-next/'],
  globals: {
    'ts-jest': {
      isolatedModules: true,
      useESM: true,
      tsconfig: {
        sourceMap: false,
      },
    },
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  extensionsToTreatAsEsm: ['.ts'],
};
