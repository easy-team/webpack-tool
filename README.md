# webpack-tool

webpack build result view, support features:

- webpack build server, build file to memory, support hot update

- webpack build file to dist

- support webpack build result ui view


## Install

```bash
$ npm i webpack-tool --save
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
    "start": "cross-env node build",
 }   
```

```bash
npm start
```

start webpack debug server: http://127.0.0.1:9000/debug


![UI-VIEW](https://github.com/hubcarl/webpack-tool/blob/master/doc/webpack-tool-ui-view.png)
