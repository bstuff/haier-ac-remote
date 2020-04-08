const path = require('path');

module.exports = {
    verbose: true,
    browser: true,
    rootDir: path.resolve(__dirname, '..'),
    testMatch: ['<rootDir>/**/*.test.(j|t)s?(x)'],
    transform: {
        '^.+\\.(j|t)sx?$': 'babel-jest',
    },
};
