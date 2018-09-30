const artTemplate = require('art-template');
const utils = require('./utils');

class NavigationPage {
  constructor(config, compiler, stat) {
    this.config = config;
    this.compiler = compiler;
    this.stat = stat;
  }

  getName() {
    const modules = this.stat.compilation.modules;
    const target = this.compiler.options.target;
    if (target === 'node') {
      return 'Server';
    }
    const isWeex = modules.some(m => /weex-vue-loader/.test(m.request));
    if (isWeex) {
      return 'Weex';
    }
    return 'Web';
  }

  normalizePublicPath(publicPath, port) {
    if (/https?:/.test(publicPath)) {
      return publicPath.replace(/:\d{2,6}\//, `:${port}/`);
    }
    const ip = utils.getIp(2);
    return `http://${ip}:${port}/${publicPath.replace(/^\//, '')}`;
  }

  filterFile(files, htmls) {
    if (htmls.length) {
      return htmls.sort().filter(url => {
        return /\.(html|htm|tpl)$/.test(url);
      });
    }
    return files.filter(filename => {
      return !/\.hot-update\.(js|json)$/.test(filename) && /\.js$/.test(filename);
    }).sort();
  }

  resolve() {
    const webpackConfig = this.compiler.options;
    const publicPath = this.normalizePublicPath(webpackConfig.output.publicPath, this.config.port);
    const assets = Object.keys(this.stat.compilation.assets).sort().map(name => {
      const url = publicPath.replace(/\/$/, '') + '/' + name.replace(/^\//, '');
      return {
        name,
        url
      };
    });
    const name = this.getName();
    const html = assets.filter(item => {
      return /\.(html|htm|tpl)$/.test(item.name);
    });
    const js = assets.filter(item => {
      return !/\.hot-update\.(js|json)$/.test(item.name) && /\.js$/.test(item.name);
    });
    const files = html.length > 0 ? html : js;
    return { name, files, html, js };
  }

  create() {
    const item = this.resolve();
    return artTemplate(`${__dirname}/view.html`, {
        result: [item]
      }
    );
  }
}

module.exports = NavigationPage;