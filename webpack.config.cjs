// Falls du CommonJS nutzt, z. B. in webpack.config.cjs:
const createExpoWebpackConfigAsync = require('@expo/webpack-config');

module.exports = async function(env, argv) {
  const config = await createExpoWebpackConfigAsync(env, argv);
  
  // Setze den publicPath passend zum Subpfad
  config.output.publicPath = '/Oberraut/';
  
  return config;
};
