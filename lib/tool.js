'use strict';
const webpack = require('webpack');
const merge = require('webpack-merge');
const koa = require('koa');
const serve = require('koa-static');
const cors = require('kcors');
const chalk = require('chalk');
const proxy = require('koa-proxy');
const utils = require('./utils');
const view = require('./view');
class WebpackTool {
  constructor(config) {
    this.config = merge({
      port: 9000,
      debugPort: 8888,
      hot: false,
    }, config);
    this.ready = false;
    this.startTime = Date.now();
  }

  processCompilation(compilation) {
    compilation.stats.forEach(stat => {
      stat.compilation.children = stat.compilation.children.filter(child => {
        return !/html-webpack-plugin/.test(child.name);
      });
    });
  }

  printCompilation(compilation) {
    compilation.stats.forEach(stat => {
      process.stdout.write(`${stat.toString(merge({
        colors: true,
        modules: false,
        children: false,
        chunks: false,
        chunkModules: false,
        entrypoints: false
      }, compilation.stat))}\n`);
    });
  }

  normalizeHotEntry(webpackConfig) {
    if (webpackConfig.target === 'web') {
      utils.normalizeHotEntry(webpackConfig, this.config.port);
    }
  }

  compilerHook(compiler, callback) {
    compiler.hooks.done.tap("webpack-tool-build-done", compilation => {
      callback(compilation);
    });
  }

  // start webpack dev server and webapck build result view
  server(webpackConfig, options, callback) {
    return this.dev(webpackConfig, options, (compiler, compilation, webpackConfigItem) => {
      this.createDebugServer(this.config.debugPort);
      callback && callback(compiler, compilation, webpackConfigItem);
    });
  }

  // start webpack dev server
  dev(webpackConfig, options, callback) {
    let readyCount = 0;
    const compilers = [];
    const webpackConfigList = Array.isArray(webpackConfig) ? webpackConfig : [webpackConfig];
    webpackConfigList.forEach((webpackConfigItem, index) => {
      this.normalizeHotEntry(webpackConfigItem);
      const compiler = webpack(webpackConfigItem);
      this.createWebpackServer(compiler);
      this.compilerHook(compiler, () => {
        readyCount++;
        if (!this.ready && readyCount % webpackConfigList.length === 0) {
          this.ready = true;
          callback && callback(compiler, compilation, webpackConfigItem);
        }
      });
      compilers.push(compiler);
    });
    return compilers;
  }

  // webpack build
  build(webpackConfig, options, callback) {
    const webpackConfigList = Array.isArray(webpackConfig) ? webpackConfig : [webpackConfig];
    const compiler = webpack(webpackConfigList, (err, compilation) => {
      if (err) {
        throw err;
      }
    });
    this.compilerHook(compiler, compilation => {
      this.processCompilation(compilation);
      this.printCompilation(compilation);
      callback && callback(compilation);
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
        console.info(chalk.green(`[webpack-tool] start webpack build navigation ui view: ${url}`));
        open(`${url}`);
      }
    });
  }

  createWebpackCompiler(webpackConfig, callback) {
    const compiler = webpack(webpackConfig);
    compiler.hooks.done.tap("webpack-tool-build-done", compilation => {
      callback && callback(compiler, compilation);
    });
    return compiler;
  }

  createWebpackServer(compiler) {
    const webpackConfig = compiler.options;
    const target = webpackConfig.target;
    const publicPath = webpackConfig.output.publicPath;
    const proxyInfo = this.config.proxy;
    const app = koa();
    app.use(cors());

    if (typeof proxyInfo === 'object') {
      // 支持多个域名代理
      const proxyList = Array.isArray(proxyInfo) ? proxyInfo : [proxyInfo];
      proxyList.forEach(item => {
        app.use(proxy(merge({
          jar: true,
          yieldNext: true,
        }, item)));
      });
    }

    const devOptions = merge({
      publicPath,
      stats: {
        colors: true,
        children: true,
        modules: false,
        chunks: false,
        chunkModules: false,
        entrypoints: false,
      },
      headers: {
        'cache-control': 'max-age=0',
      },
      watchOptions: {
        ignored: /node_modules/,
      }
    }, { stats: webpackConfig.stats, watchOptions: webpackConfig.watchOptions });

    const devMiddleware = require('./dev')(compiler, devOptions);
    app.use(devMiddleware);

    if (target === 'web' || target === undefined ) {
      const hotMiddleware = require('koa-webpack-hot-middleware')(compiler, {
        log: false,
        reload: true
      });
      app.use(hotMiddleware);
    }

    utils.getPort(this.config.port).then(port => {
      app.listen(port, err => {
        if (!err && compiler) {
          const ip = utils.getIp();
          const url = `http://${ip}:${port}`;
          if(target){
            console.info(chalk.green(`\r\n [webpack-tool] start webpack ${target} building server: ${url}`));
          } else {
            console.info(chalk.green(`\r\n [webpack-tool] start webpack building server: ${url}`));
          }
        }
      });
    })
  }
}

module.exports = WebpackTool;