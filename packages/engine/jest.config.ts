/** @type {import('ts-jest').JestConfigWithTsJest} */
const config = {
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
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
};

// /** @type {import('jest').Config} */
// const config = {
//     preset: 'ts-jest',
//     testEnvironment: 'node',
//     moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
//     transform: {
//       '^.+\\.(ts|tsx)$': 'ts-jest',
//     },
//     testMatch: ['**/__tests__/**/*.[jt]s?(x)', '**/?(*.)+(spec|test).[jt]s?(x)'],
//   };

module.exports = config;
