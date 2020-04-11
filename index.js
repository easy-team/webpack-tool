'use strict';
module.exports = exports = require('./lib/tool');
exports.utils = require('./lib/utils');
exports.webpack = exports.utils.getWebpack();
exports.merge = require('webpack-merge');