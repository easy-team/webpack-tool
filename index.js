'use strict';
module.exports = exports = require('./lib/tool');
exports.utils = require('./lib/utils');
exports.webpack = utils.getWebpack();
exports.merge = require('webpack-merge');