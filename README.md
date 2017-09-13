# Webpack-tool

Webpack3 (3.0.0) And Webpack2 (2.0.0) Build Tool, Support Features:

- Webpack build server, file memory, hot update.

- Webpack build file to disk.

- Support Webpack build result ui view.


## Install

```bash
$ npm i Webpack-tool --save
```

## Usage

```js
//build/index.js
const WebpackTool = require('webpack-tool');
const weexNativeConfig = require('./weex/native');
const weexWebConfig = require('./weex/web');
const NODE_SERVER = process.env.NODE_SERVER;

const webpackConfig = [weexNativeConfig, weexWebConfig];

const webpackTool = new WebpackTool();

if (NODE_SERVER) {
  webpackTool.server(webpackConfig);
} else {
  webpackTool.build(webpackConfig);
}
```


## Run

```js
"scripts": {
  "start": "cross-env node build"
 }   
```

```bash
npm start
```

Start Webpack Debug Server: http://127.0.0.1:9000/debug


![UI-VIEW](https://github.com/hubcarl/Webpack-tool/blob/master/doc/Webpack-tool-ui-view.png)
