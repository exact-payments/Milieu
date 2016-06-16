const fs                = require('fs');
const path              = require('path');
const deepExtend        = require('deep-extend');
const minimist          = require('minimist');
let   ini;              // Lazy loaded
let   yaml;             // Lazy loaded
const printExplainTable = require('./explain-table');


class Milieu {

  constructor(applicationName, defaults, opts) {
    opts                    || (opts                    = {});
    opts.argv               || (opts.argv               = process.argv);
    opts.env                || (opts.env                = process.env);
    opts.platform           || (opts.platform           = process.platform);
    opts.cwd                || (opts.cwd                = process.cwd());
    opts.unsetEnvValues     || (opts.unsetEnvValues     = false);
    opts.parseValues        || (opts.parseValues        = true);

    if (typeof applicationName !== 'string') {
      throw new Error('applicationName must be a string');
    }
    if (!defaults || typeof defaults !== 'object') {
      throw new Error('defaults must be an object');
    }

    this.__$                    = {};
    this.__$.applicationName    = applicationName;
    this.__$.defaults           = deepExtend({}, defaults);
    this.__$.argv               = minimist(opts.argv);
    this.__$.env                = opts.env;
    this.__$.platform           = opts.platform;
    this.__$.cwd                = opts.cwd;
    this.__$.unsetEnvValues     = opts.unsetEnvValues;
    this.__$.parseValues        = opts.parseValues;
    this.__$.configFlagPath     = '';
    this.__$.config             = null;

    this._compileConfig();
  }

  explain() {
    const explanation = deepExtend({}, this.__$.defaults);
    const configs     = this._getConfigDataAndPaths();
    const flagData    = this._getFlagData();
    const envData     = this._getEnvData();

    this._templateFromEnv(envData);
    this._templateFromEnv(flagData);
    this._templateFromEnv(explanation);
    for (const config of configs) { this._templateFromEnv(config); }

    const setValSrcRec = function(ctx, src) {
      for (const key in ctx) {
        if (ctx[key] && typeof ctx[key] === 'object') {
          setValSrcRec(ctx[key], src);
        } else {
          ctx[key] = { val: ctx[key], src };
        }
      }
    };

    setValSrcRec(explanation, 'defaults');
    setValSrcRec(flagData,    'flag');
    setValSrcRec(envData,     'environment');
    for (let i = 0; i < configs.length; i += 1) {
      const absPath = configs[i].path;
      const relPath = path.relative(this.__$.cwd, absPath);
      setValSrcRec(configs[i].data, absPath.length > relPath.length ? relPath : absPath);
    }

    for (let i = 0; i < configs.length; i += 1) {
      deepExtend(explanation, configs[i].data);
    }
    deepExtend(explanation, envData);
    deepExtend(explanation, flagData);

    return explanation;
  }

  printExplainTable() {
    printExplainTable(this.__$.applicationName, this.explain());
  }

  toObject() {
    return deepExtend({}, this.__$.config);
  }

  _compileConfig() {
    const config = deepExtend({}, this.__$.defaults);
    deepExtend(config, this._getMergedConfigData());
    deepExtend(config, this._getEnvData());
    deepExtend(config, this._getFlagData());

    this._templateFromEnv(config);

    this.__$.config = config;

    for (const prop in config) {
      if (this[prop]) { continue; }
      this[prop] = config[prop];
    }
  }

  _getFlagData() {
    if (this.__$.argv.config) { this.__$.configFlagPath = this.__$.argv.config; }
    const flagData = {};
    for (const flag in this.__$.argv) {
      if (flag === '_') { continue; }
      this.constructor._setPath(flagData, this._convertFlagToPath(flag), this.__$.argv[flag]);
    }
    return flagData;
  }

  _getMergedConfigData() {
    const configData = {};
    const configs    = this._getConfigDataAndPaths();

    for (let i = 0; i < configs.length; i += 1) {
      deepExtend(configData, configs[i].data);
    }

    return configData;
  }

  _getConfigDataAndPaths() {
    return this._collectConfigPaths().map((configPath) => {
      const src = fs.readFileSync(configPath, 'utf8');
      const ext = path.extname(configPath);
      let   data;

      switch (ext) {
        case 'json': data = this.constructor._tryParseJson(src); break;
        case 'ini' : data = this.constructor._tryParseIni(src);  break;
        case 'yaml': data = this.constructor._tryParseYaml(src); break;
        default    : data = this.constructor._tryParse(src);     break;
      }

      if (!data) {
        console.warn(
          `Failed to parse config ${configPath}. Note that yaml and ini ` +
          'configuration files require modules `js-yaml` and/or `ini` to be ' +
          'installed. Skipping unparsable config.'
        );
      }

      return { path: configPath, data };
    });
  }

  _collectConfigPaths() {
    const isWin    = this.__$.platform === 'win32';
    const userPath = this.__$.env[isWin ? 'USERPROFILE' : 'HOME'];

    if (this.__$.configFlagPath) {
      if (
        fs.existsSync(this.__$.configFlagPath) &&
        fs.statSync(this.__$.configFlagPath).isFile()
      ) {
        throw new Error(`${this.__$.configFlagPath} does not exist`);
      }
      return [this.__$.configFlagPath];
    }

    let   configPaths = [];
    const cwdPathChunks = this.__$.cwd.slice(1).split(path.sep);
    while (cwdPathChunks.length > 0) {
      const basePath = cwdPathChunks.join(path.sep);

      // ./.apprc
      // ../.apprc
      // ../../.apprc
      // ../../../.apprc
      // etc...
      configPaths.push(path.sep + path.join(basePath, `.${this.__$.applicationName}rc`));
      cwdPathChunks.pop();
    }

    if (!isWin) {
      configPaths.push(
        // /etc/apprc
        `/etc/${this.__$.applicationName}rc`,
        // /etc/app/config
        `/etc/${this.__$.applicationName}/config`,
        // /usr/local/etc/apprc
        `/usr/local/etc/${this.__$.applicationName}rc`,
        // /usr/local/etc/app/config
        `/usr/local/etc/${this.__$.applicationName}/config`
      );
    }

    configPaths.push(
      // ~/.apprc
      path.join(userPath, `.${this.__$.applicationName}rc`),
      // ~/.app/config
      path.join(userPath, `.${this.__$.applicationName}`, 'config'),
      // ~/.config/app
      path.join(userPath, '.config', this.__$.applicationName),
      // ~/.config/app/config
      path.join(userPath, '.config', this.__$.applicationName, 'config')
    );

    for (let i = 0, len = configPaths.length; i < len; i += 1) {
      const configPath = configPaths.shift();
      configPaths.push(
        configPath,
        `${configPath}.json`,
        `${configPath}.ini`,
        `${configPath}.yaml`
      );
    }

    configPaths = configPaths.filter((configPath) =>
      fs.existsSync(configPath) && fs.statSync(configPath).isFile());

    return configPaths;
  }

  _addUserConfigPathsToArray(configPaths) {
    const userPath = this.__$.env[this.__$.platform === 'win32' ? 'USERPROFILE' : 'HOME'];
    if (!userPath) { return; }
    return [
    ].filter((path) => fs.existsSync(path) && fs.statsSync(path).isFile());
  }

  _getEnvData() {
    const data = {};
    for (const key in this.__$.env) {
      if (!this._envKeyBelongsToApp(key)) { continue; }

      const path = this._convertEnvKeyToPath(key);
      const val  = this._parseValue(this.__$.env[key]);
      this.constructor._setPath(data, path, val);

      if (this.__$.unsetEnvValues) {
        delete this.__$.env[key];
      }
    }

    return data;
  }

  _parseValue(val) {
    if (!this.__$.parseValues) { return val; }

    if (val === 'null')  { return null; }
    if (val === 'true')  { return true; }
    if (val === 'false') { return false; }
    if (val === 'NaN')   { return NaN; }

    if (val.match(/^\d+$/)) {
      const num = parseFloat(val);
      if (num.toString() === val) {
        return num;
      }
    }

    return val;
  }

  _envKeyBelongsToApp(key) {
    return key.slice(0, this.__$.applicationName.length + 2).toLowerCase() ===
      `${this.__$.applicationName.toLowerCase()}__`;
  }

  _convertEnvKeyToPath(key) {
    key = key
      .slice(this.__$.applicationName.length + 2)
      .toLowerCase()
      .replace(/__/g, '.')
      .replace(/_([\w])/g, (_, char) => char.toUpperCase());
    return key;
  }

  _convertFlagToPath(key) {
    key = key
      .toLowerCase()
      .replace(/_{2}|\-{2}/g, '.')
      .replace(/[_-]([\w])/g, (_, char) => char.toUpperCase());
    return key;
  }

  _templateFromEnv(config) {
    const templateObj = (ctx) => {
      for (const key in ctx) {
        let val = ctx[key];

        if (val && typeof val === 'object') {
          templateObj(val);
          continue;
        }
        if (typeof val !== 'string') { continue; }
        const tokens = val.match(/\${[\w\d]+}/g);
        if (!tokens) { continue;  }

        for (const token of tokens) {
          const key = token.slice(2, token.length - 1);
          if (process.env[key] === undefined) { continue; }
          val = val.replace(token, process.env[key]);
        }

        ctx[key] = val;
      }
    };

    templateObj(config);
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
  let tryParsers;
  if (this._guessIsJson(src)) {
    tryParsers = [this._tryParseJson, this._tryParseIni, this._tryParseYaml];
  } else if (this._guessIsIni(src)) {
    tryParsers = [this._tryParseIni, this._tryParseJson, this._tryParseYaml];
  } else if (this._guessIsYaml(src)) {
    tryParsers = [this._tryParseYaml, this._tryParseJson, this._tryParseIni];
  }

  let data;
  for (let i = 0; i < tryParsers.length; i += 1) {
    data = tryParsers[i](src);
    if (data) { break; }
  }
  return data;
};

Milieu._tryParseJson = function(src) {
  try {
    return JSON.parse(src);
  } catch (_) {
    return null;
  }
};

Milieu._tryParseIni = function(src) {
  ini || (ini = global.__testIni__ || require('ini')); // eslint-disable-line global-require
  try {
    return ini.parse(src);
  } catch (_) {
    return null;
  }
};

Milieu._tryParseYaml = function(src) {
  yaml || (yaml = global.__testYaml__ || require('js-yaml')); // eslint-disable-line global-require
  try {
    return yaml.safeLoad(src);
  } catch (_) {
    return null;
  }
};

Milieu._setPath = function(ctx, ctxPath, val) {
  const pathChunks = ctxPath.split('.');
  for (let i = 0; i < pathChunks.length - 1; i += 1) {
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


module.exports = Milieu;
