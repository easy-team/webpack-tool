'use strict';
const path = require('path');
const webpack = require('webpack');
const merge = require('webpack-merge');
const koa = require('koa');
const cors = require('kcors');
const open = require('opn');
const chalk = require('chalk');
const artTemplate = require('art-template');
const utils = require('./utils');
class WebpackTool {
  constructor(config) {
    this.config = merge({
      port: 9000,
      template: `${__dirname}/view.html`
    }, config);
    this.artTemplate = artTemplate;
    this.webpackBuildResult = {};
    this.isStartDebugServer = false;
  }

  setConfig(config) {
    this.config = merge(this.config, config);
  }

  normalizeHotEntry(webpackConfig, port) {
    const hotMiddleware = require.resolve('webpack-hot-middleware').split(path.sep);
    hotMiddleware.pop();
    const hotConfig = `${path.posix.join(hotMiddleware.join(path.sep))}/client?path=http://${utils.getIp()}:${port}/__webpack_hmr&noInfo=false&reload=true&quiet=false`;
    Object.keys(webpackConfig.entry).forEach(name => {
      if (!/\./.test(name)) {
        webpackConfig.entry[name] = [hotConfig].concat(webpackConfig.entry[name]);
      }
    });
    return webpackConfig;
  }

  server(webpackConfig) {
    let buildCount = 0;
    const webpackConfigList = Array.isArray(webpackConfig) ? webpackConfig : [webpackConfig];
    webpackConfigList.forEach((webpackConfigItem, index) => {
      const port = this.config.port + index + 1;
      const isNode = webpackConfigItem.target === 'node';
      if (!isNode) {
        this.normalizeHotEntry(webpackConfigItem, port);
      }
      const compiler = webpack([webpackConfigItem]);
      this.createWebpackServer(compiler, {
        hot: !isNode,
        port: port,
        publicPath: webpackConfigItem.output.publicPath,
      });
      compiler.plugin('done', compilation => {
        buildCount++;
        const htmls = [];
        compilation.stats.forEach(stat => {
          stat.compilation.children.forEach(child => {
            Array.prototype.push.apply(htmls, Object.keys(child.assets))
          });
          this.webpackBuildResult[port] = {
            port,
            stat,
            htmls,
            files: Object.keys(stat.compilation.assets),
            webpackConfig: webpackConfigItem,
          }
        });
        // all webpack build finish
        if (!this.isStartDebugServer && buildCount % webpackConfigList.length === 0) {
          this.isStartDebugServer = true;
          this.createDebugServer(this.config.port);
        }
      });
    });
  }

  build(webpackConfig, callback) {
    const webpackConfigList = Array.isArray(webpackConfig) ? webpackConfig : [webpackConfig];
    const compiler = this.config.isServerBuild ? webpack(webpackConfigList) : webpack(webpackConfigList, (err, compilation) => {
      if (err) {
        throw err;
      }
    });
    compiler.plugin('done', compilation => {
      compilation.stats.forEach(stat => {
        stat.compilation.children = stat.compilation.children.filter(child => {
          return child.name !== 'extract-text-webpack-plugin' && !/html-webpack-plugin/.test(child.name);
        });
      });
      if (!this.config.isServerBuild) {
        compilation.stats.forEach(stat => {
          process.stdout.write(`${stat.toString(merge({
            colors: true,
            modules: false,
            children: false,
            chunks: false,
            chunkModules: false
          }, this.config && this.config.stat))}\n`);
        });
      }
      callback && callback(compiler, compilation);
    });
    return compiler;
  }

  createDebugServer(port) {
    const self = this;
    const app = koa();
    app.use(cors());
    app.use(function *(next) {
      if (this.url === '/debug') {
        this.body = self.renderDebugTemplate.bind(self)(self.webpackBuildResult);
      } else {
        yield next;
      }
    });
    app.listen(port, err => {
      if (!err) {
        const ip = utils.getIp();
        const url = `http://${ip}:${port}/debug`;
        console.info(chalk.green(`[webpack-tool] start webpack debug server: ${url}`));
        open(`${url}`);
      }
    });
  }

  createWebpackServer(compiler, config) {

    const port = config.port;
    const hot = config.hot;
    const publicPath = config.publicPath;

    const app = koa();

    app.use(cors());

    const devMiddleware = require('koa-webpack-dev-middleware')(compiler, {
      publicPath,
      stats: {
        colors: true,
        children: true,
        modules: false,
        chunks: false,
        chunkModules: false,
      },
      watchOptions: {
        ignored: /node_modules/,
      },
    });

    app.use(devMiddleware);

    if (hot === undefined || hot) {
      const hotMiddleware = require('koa-webpack-hot-middleware')(compiler, {
        log: false,
        reload: true,
      });
      app.use(hotMiddleware);
    }

    app.listen(port, err => {
      if (!err) {
        const ip = utils.getIp();
        const url = `http://${ip}:${port}`;
        console.info(chalk.green(`\r\n [webpack-tool] start webpack building server: ${url}`));
      }
    });
  }

  openBrowser(port, url) {
    if (!url) {
      const ip = utils.getIp();
      url = `http://${ip}:${port}`;
    }
    open(url);
  }

  getBuildName(stat) {
    const modules = stat.compilation.modules;
    const target = stat.compilation.options.target;
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
      return htmls.sort();
    }
    return files.filter(filename => {
      return !/\.hot-update\.js$/.test(filename) && /\.js$/.test(filename);
    }).sort();
  }

  renderDebugTemplate(webpackBuildResult) {
    const buildFiles = [];
    Object.keys(webpackBuildResult).forEach(key => {
      const webpackResult = webpackBuildResult[key];
      const webpackConfig = webpackResult.webpackConfig;
      const builds = {
        name: this.getBuildName(webpackResult.stat),
        files: []
      };
      const publicPath = this.normalizePublicPath(webpackConfig.output.publicPath, webpackResult.port);
      const viewFiles = this.filterFile(webpackResult.files, webpackResult.htmls);
      viewFiles.forEach(filepath => {
        builds.files.push({
          name: filepath,
          url: publicPath.replace(/\/$/, '') + '/' + filepath.replace(/^\//, '')
        });
      });
      buildFiles.push(builds);
    });
    return this.artTemplate(this.config.template, { buildFiles });
  }
}

module.exports = WebpackTool;