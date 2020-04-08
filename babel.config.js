module.exports = function(api) {
  api.cache(() => process.env.NODE_ENV);

  return {
    compact: false,
    sourceMaps: 'both',
    retainLines: true,
    presets: [
      [
        '@babel/preset-env',
        {
          // caller.target will be the same as the target option from webpack
          targets: api.caller((caller) => caller && caller.target === 'node')
            ? { node: 12 }
            : { chrome: '78' },
          debug: Boolean(process.env.BABEL_DEBUG),
          corejs: 3,
          useBuiltIns: 'entry',
          modules: 'commonjs',
        },
      ],
      '@babel/preset-typescript',
    ],
    plugins: [['@babel/plugin-proposal-class-properties', { loose: false }]],
  };
};
