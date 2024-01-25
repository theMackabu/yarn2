module.exports = {
  only: ['src/**/*.js', '__tests__/**/*.js'],
  targets: { esmodules: false, node: '12' },
  assumptions: { enumerableModuleMeta: true },
  presets: ['@babel/preset-flow'],
  plugins: [
    '@babel/plugin-transform-runtime',
    '@babel/plugin-proposal-function-bind',
    ['babel-plugin-inline-import', { extensions: ['.tpl.js'] }],
    ['transform-inline-imports-commonjs', { allowTopLevelThis: true, strict: false, loose: true }],
    ['@babel/plugin-transform-modules-commonjs', { importInterop: 'none', allowTopLevelThis: true }],
  ],
};
