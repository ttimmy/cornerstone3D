/* eslint-disable */
const base = require('../../jest.config.base.js');
const path = require('path');

module.exports = {
  ...base,
  testMatch: [
    ...base.testMatch,

    // Add TS files
    '<rootDir>/test/**/*.jest.ts'
  ],
  displayName: 'core',
  setupFiles: ['jest-canvas-mock'],
  moduleNameMapper: {
    '^@cornerstonejs/(.*)$': path.resolve(__dirname, '../$1/src'),
  },
};
