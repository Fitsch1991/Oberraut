const createExpoWebpackConfigAsync = require('@expo/webpack-config');

module.exports = async function (env, argv) {
  const config = await createExpoWebpackConfigAsync(env, argv);

  // Wenn deine App unter https://Fitsch1991.github.io/Oberraut/ laufen soll:
  config.output.publicPath = '/Oberraut/';

  return config;
};
