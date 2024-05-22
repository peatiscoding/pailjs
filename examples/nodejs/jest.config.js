module.exports = {
  displayName: 'pail-nodejs',
  testEnvironment: 'node',
  testRegex: [/__tests__\/.*(test|spec)\.ts$/],
  collectCoverageFrom: ['src/**/*.(t|j)s'],
  coveragePathIgnorePatterns: ['<rootDir>/src/mikro-orm.config.ts'],
  coverageReporters: ['lcov', 'text-summary', 'text', 'html', 'cobertura'],
  coverageDirectory: './coverage',
  collectCoverage: true,
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  workerIdleMemoryLimit: '512MB',
  testTimeout: 15000,
}
