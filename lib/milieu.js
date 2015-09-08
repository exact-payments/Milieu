
var fs                = require('fs');
var path              = require('path');
var deepExtend        = require('deep-extend');
var minimist          = require('minimist');
var ini;              // Lazy loaded
var yaml;             // Lazy loaded
var printExplainTable = require('./explain-table');


function Milieu(applicationName, defaults, opts) {
  opts                    || (opts                    = {});
  opts.argv               || (opts.argv               = process.argv);
  opts.env                || (opts.env                = process.env);
  opts.platform           || (opts.platform           = process.platform);
  opts.cwd                || (opts.cwd                = process.cwd());
  opts.useExplainFlag     || (opts.useExplainFlag     = true);
  opts.unsetEnvValues     || (opts.unsetEnvValues     = false);
  opts.parseValues        || (opts.parseValues        = true);
  opts.useLegacyEnvValues || (opts.useLegacyEnvValues = false);

  if (typeof applicationName !== 'string') {
    throw new Error('applicationName must be a string');
  }
  if (!defaults || typeof defaults !== 'object') {
    throw new Error('defaults must be an object');
  }

  this.applicationName    = applicationName;
  this.defaults           = deepExtend({}, defaults);
  this.argv               = minimist(opts.argv);
  this.env                = opts.env;
  this.platform           = opts.platform;
  this.cwd                = opts.cwd;
  this.unsetEnvValues     = opts.unsetEnvValues;
  this.parseValues        = opts.parseValues;
  this.useLegacyEnvValues = opts.useLegacyEnvValues;

  this._configFlagPath  = '';

  if (this.argv['explain-config']) {
    delete this.argv['explain-config'];
    this.printExplainTable();
    process.exit();
  }
}

Milieu._guessIsJson = function(src) {
  return !!src
    // remove leading whitespace
    .replace(/^\s+/, '')
    // strip comments
    .replace(/\/\/[^\n]+/g, '')
    // check for the beginning of an object
    .match(/^\{/);
};

Milieu._guessIsIni = function(src) {
  return !!src
    // remove leading whitespace
    .replace(/^\s+/, '')
    // strip comments
    .replace(/;[^\n]+/g, '')
    // match an ini header or asignment
    .match(/^\[[^\]\s]+\]|[^\n\s]+\s*=\s*[^\n\s]/);
};

Milieu._guessIsYaml = function(src) {
  return !!src
    // remove leading whitespace
    .replace(/^\s+/, '')
    // remove comments
    .replace(/#[^\n]+/g, '')
    // match a yaml key
    .match(/^[^:\n]+:/);
};

Milieu._tryParse = function(src) {
  var tryParsers;
  if (this._guessIsJson(src)) {
    tryParsers = [this._tryParseJson, this._tryParseIni, this._tryParseYaml];
  } else if (this._guessIsIni(src)) {
    tryParsers = [this._tryParseIni, this._tryParseJson, this._tryParseYaml];
  } else if (this._guessIsYaml(src)) {
    tryParsers = [this._tryParseYaml, this._tryParseJson, this._tryParseIni];
  }

  var data;
  for (var i = 0; i < tryParsers.length; i += 1) {
    data = tryParsers[i](src);
    if (data) { break; }
  }
  return data;
};

Milieu._tryParseJson = function(src) {
  try {
    return JSON.parse(src);
  } catch(_) {
    return null;
  }
};

Milieu._tryParseIni = function(src) {
  ini || (ini = global.__testIni__ || require('ini'));
  try {
    return ini.parse(src);
  } catch(_) {
    return null;
  }
};

Milieu._tryParseYaml = function(src) {
  yaml || (yaml = global.__testYaml__ || require('js-yaml'));
  try {
    return yaml.safeLoad(src);
  } catch(_) {
    return null;
  }
};

Milieu._setPath = function(ctx, ctxPath, val) {
  var pathChunks = ctxPath.split('.');
  for (var i = 0; i < pathChunks.length - 1; i += 1) {
    if (typeof ctx[pathChunks[i]] !== 'object') {
      if (
        pathChunks[i + 1] !== undefined &&
        parseFloat(pathChunks[i + 1]).toString() === pathChunks[i + 1]
      ) {
        ctx[pathChunks[i]] = [];
      } else {
        ctx[pathChunks[i]] = {};
      }
    }
    ctx = ctx[pathChunks[i]];
  }
  ctx[pathChunks.pop()] = val;
};

Milieu.prototype.explain = function() {
  var explanation = deepExtend({}, this.defaults);
  var configs     = this._getConfigDataAndPaths();
  var flagData    = this._getFlagData();
  var envData     = this._getEnvData();

  var setValSrcRec = function(ctx, src) {
    for (var key in ctx) {
      if (ctx[key] && typeof ctx[key] === 'object') {
        setValSrcRec(ctx[key], src);
      } else {
        ctx[key] = { val: ctx[key], src: src };
      }
    }
  };

  setValSrcRec(explanation, 'defaults');
  setValSrcRec(flagData, 'flag');
  setValSrcRec(envData, 'environment');
  for (var i = 0; i < configs.length; i += 1) {
    setValSrcRec(configs[i].data, configs[i].path);
  }

  for (var i = 0; i < configs.length; i += 1) {
    deepExtend(explanation, configs[i].data);
  }
  deepExtend(explanation, envData);
  deepExtend(explanation, flagData);

  return explanation;
};

Milieu.prototype.printExplainTable = function() {
  printExplainTable(this.applicationName, this.explain());
};

Milieu.prototype.toObject = function() {
  var config = deepExtend({}, this.defaults);
  deepExtend(config, this._getMergedConfigData());
  deepExtend(config, this._getEnvData());
  deepExtend(config, this._getFlagData());
  return config;
};

Milieu.prototype._getFlagData = function() {
  if (this.argv.config) { this._configFlagPath = this.argv.config; }
  var flagData = {};
  for (var flag in this.argv) {
    if (flag === '_') { continue; }
    this.constructor._setPath(flagData, this._convertFlagToPath(flag), this.argv[flag]);
  }
  return flagData;
};

Milieu.prototype._getMergedConfigData = function() {
  var configData = {};
  var configs    = this._getConfigDataAndPaths();

  for (var i = 0; i < configs.length; i += 1) {
    deepExtend(configData, configs[i].data);
  }

  return configData;
};

Milieu.prototype._getConfigDataAndPaths = function() {
  var _this = this;
  return this._collectConfigPaths().map(function(configPath) {
    var src = fs.readFileSync(configPath, 'utf8');
    var ext = path.extname(path);
    var data;

    switch(ext) {
      case 'json': data = _this.constructor._tryParseJson(src); break;
      case 'ini' : data = _this.constructor._tryParseIni(src);  break;
      case 'yaml': data = _this.constructor._tryParseYaml(src); break;
      default    : data = _this.constructor._tryParse(src);     break;
    }

    if (!data) {
      console.warn(
        'Failed to parse config ' + configPath + '. Note that yaml and ini ' +
        'configuration files require modules `js-yaml` and/or `ini` to be ' +
        'installed. Skipping unparsable config.'
      );
    }

    return {
      path: configPath,
      data: data
    };
  });
};

Milieu.prototype._collectConfigPaths = function() {
  var isWin    = this.platform === 'win32';
  var userPath = this.env[isWin ? 'USERPROFILE' : 'HOME'];

  if (this._configFlagPath) {
    if (
      fs.existsSync(this._configFlagPath) &&
      fs.statSync(this._configFlagPath).isFile()
    ) {
      throw new Error(this._configFlagPath + ' does not exist');
    }
    return [this._configFlagPath];
  }

  var configPaths = [];
  var cwdPathChunks = this.cwd.slice(1).split(path.sep);
  while(cwdPathChunks.length > 0) {
    var basePath = cwdPathChunks.join(path.sep);

    // ./.apprc
    // ../.apprc
    // ../../.apprc
    // ../../../.apprc
    // etc...
    configPaths.push(path.sep + path.join(basePath, '.' + this.applicationName + 'rc'));
    cwdPathChunks.pop();
  }

  if (!isWin) {
    configPaths.push(
      // /etc/apprc
      '/etc/' + this.applicationName + 'rc',
      // /etc/app/config
      '/etc/' + this.applicationName + '/config',
      // /usr/local/etc/apprc
      '/usr/local/etc/' + this.applicationName + 'rc',
      // /usr/local/etc/app/config
      '/usr/local/etc/' + this.applicationName + '/config'
    );
  }

  configPaths.push(
    // ~/.apprc
    path.join(userPath, '.' + this.applicationName + 'rc'),
    // ~/.app/config
    path.join(userPath, '.' + this.applicationName, 'config'),
    // ~/.config/app
    path.join(userPath, '.config', this.applicationName),
    // ~/.config/app/config
    path.join(userPath, '.config', this.applicationName, 'config')
  );

  for (var i = 0, len = configPaths.length; i < len; i += 1) {
    var configPath = configPaths.shift();
    configPaths.push(
      configPath,
      configPath + '.json',
      configPath + '.ini',
      configPath + '.yaml'
    );
  }

  configPaths = configPaths.filter(function(configPath) {
    return fs.existsSync(configPath) && fs.statSync(configPath).isFile();
  });

  return configPaths;
};

Milieu.prototype._addUserConfigPathsToArray = function(configPaths) {
  var userPath = this.env[this.platform === 'win32' ? 'USERPROFILE' : 'HOME'];
  if (!userPath) { return; }
  return [
  ].filter(function(path) {
    return fs.existsSync(path) && fs.statsSync(path).isFile()
  });
};

Milieu.prototype._addSystemConfigPathsToArray = function(configPaths) {
  if (this.platform === 'win32') { return; }

  return [
  ].filter(function(path) {
    return fs.existsSync(path) && fs.statsSync(path).isFile()
  });
};

Milieu.prototype._getEnvData = function() {
  if (this.useLegacyEnvValues) {
    // FIXME: Legacy vars are depricated because they require sniffing the
    //        defaults object to find the ENV vars.
    console.warn('DEPRICATED: Using legacy ENV variable scheme. See the readme for migration.');
    return this._setFromLegacyEnvValues();
  }

  var data = {};
  for (var key in this.env) {
    if (!this._envKeyBelongsToApp(key)) { continue; }

    var path = this._convertEnvKeyToPath(key);
    var val  = this._parseValue(this.env[key]);
    this.constructor._setPath(data, path, val);

    if (this.unsetEnvValues) {
      delete this.env[key];
    }
  }

  return data;
};

Milieu.prototype._setFromLegacyEnvValues = function() {
  var _this = this;

  var objRec = function(basePath, ctx) {
    for (var key in ctx) {
      var envKey = key ? basePath + '_' + key : key;
      if (ctx[key] && typeof ctx[key] === 'object' && typeof ctx[key].length === 'number') {
        arrRec(basePath, ctx[key]);
      } else if (ctx[key] && typeof ctx[key] === 'object') {
        rec(envKey, ctx[key]);
      } else {
        if (this.env[envKey]) {
          ctx[key] = this.env[envKey];
          if (_this.unsetEnvValues) {
            delete this.env[key];
          }
        }
      }
    }
  }

  var arrRec = function(basePath, ctx) {
    var regex = new RegExp('^' + basePath + '_([\d])_', 'g');

    ctx.length = 0;
    Object.keys(this.env).map(function(envKey) {
      var match = envKey.match(regex);
      var index = match ? match[1] : null;
      return { key: envKey, index: index };
    }).filter(function(envArr) {
      return envArr.index !== null;
    }).map(function(envArr) {
      ctx[envArr.index] = _this._parseValue(this.env[envArr.key]);
      if (_this.unsetEnvValues) {
        delete this.env[key];
      }
    });
  }

  objRec('', this.config);
};

Milieu.prototype._parseValue = function(val) {
  if (!this.parseValues) { return val; }

  if (val === 'null')  { return null; }
  if (val === 'true')  { return true; }
  if (val === 'false') { return false; }
  if (val === 'NaN')   { return NaN; }

  if (val.match(/^\d+$/)) {
    var num = parseFloat(val);
    if (num.toString() === val) {
      return num;
    }
  }

  return val;
};

Milieu.prototype._envKeyBelongsToApp = function(key) {
  return key.slice(0, this.applicationName.length + 2).toLowerCase() === this.applicationName.toLowerCase() + '__';
};

Milieu.prototype._convertEnvKeyToPath = function(key) {
  key = key
    .slice(this.applicationName.length + 2)
    .toLowerCase()
    .replace(/__/g, '.')
    .replace(/_([\w])/g, function(_, char) {
      return char.toUpperCase();
    });
  return key;
};

Milieu.prototype._convertFlagToPath = function(key) {
  key = key
    .toLowerCase()
    .replace(/_{2}|\-{2}/g, '.')
    .replace(/[_-]([\w])/g, function(_, char) {
      return char.toUpperCase();
    });
  return key;
};


module.exports = Milieu;
