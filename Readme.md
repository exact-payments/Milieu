
# Milieu

Milieu is a config loader in the spirit of
[rc](https://github.com/dominictarr/rc) It shares the same features as RC, but
goes a few steps further.

Milieu loads config values from argv flags, environment variables, and config
files. The values are compiled into a single config object which you can use
in your application. You can trace the sources of these values using Milieu's
explain feature.

Milieu can parse JSON config files out of the box. You can also use INI and YAML
files by installing the optional dependencies
[ini](https://github.com/isaacs/ini) and/or
[js-yaml](https://github.com/nodeca/js-yaml) modules.

> The word milieu is defined as the physical or social setting in which people
> live or in which something happens or develops.

```javascript
var milieu = require('milieu');

var config = milieu('application-name', {
  server: {
    port: 8001
  },
  mongo: {
    url: 'mongodb://localhost'
  }
});
```

### Milieu Compile Order
Milieu looks in the following places and compiles a config by merging upward
through the following sources. Items highest in the list get the highest
priority, and override config values in the sources below.

0. argv flags - Ex. `--test.myKey=val` becomes `config.test.myKey === 'val'`
   in the config. Anything after -- is ignored.
0. environment variables - Ex. `TEST__MY_KEY="val"` becomes
   `config.test.myKey === 'val'`
0. config files (replace {appname} with the name of your application)
  (Accepts JSON, INI, or YAML) (File extensions are optional)
  0. ~/.{appname}rc
  0. ~/.{appname}/config
  0. ~/.config/{appname}
  0. ~/.config/{appname}/config
  0. /etc/{appname}rc
  0. /etc/{appname}/config
  0. /usr/local/etc/{appname}rc
  0. /usr/local/etc/{appname}/config
  0. ./.{appname}rc
  0. ../.{appname}rc
  0. ../../.{appname}rc
  0. ../../../.{appname}rc
  0. ...


## Milieu Explain
Milieu has a feature called explain. It can be used by passing the flag
`--explain-config` to your program. There are also two methods;
`milieu.explain()` and `milieu.printExplainTable()`.
`milieu.explain()` returns an object indicating the origin of each config value. `milieu.printExplainTable()` prints a table to stdout which can be used to
inspect your config from the cli. This is great for understanding how your
configuration was resolved, and can be helpful for debugging production systems.

Lets suppose we have a config for our server at `/etc/application-name/config`.
In it we set the value of `server.port` and nothing else. We also execute our
application below passing the flag `--debug true`. Our explanation object will
contain the origin of each config key as shown below.
```javascript
var milieu = require('milieu');

var explanation = milieu.explain('application-name', {
  server: {
    port: 8001
  },
  mongo: {
    url: 'mongodb://localhost'
  },
  debug: false
});

explanation === {
  server: {
    port: '/etc/application-name/config'
  },
  mongo: {
    url: 'default'
  },
  debug: 'flag'
}
```

If you wish to generate a table on the command line instead of working with an
explanation object, call `milieu.printExplainTable`.

```javascript
var milieu = require('milieu');

// prints table to stdout
milieu.printExplainTable('application-name', {
  server: {
    port: 8001
  },
  mongo: {
    url: 'mongodb://localhost'
  },
  debug: false
});
```


## Legacy Support (Deprecated)
At E-xact our previous configuration loader used a different ENV variable
scheme. We don't recommend using this scheme, but it can be enabled by setting
`opts.useLegacyEnvValues` to true when initializing Milieu.

### Migration from Legacy ENV Scheme
To convert ENV variables by first prefixing their keys with the
`{appname}__` and replace `_` with `__`. If your keys are camel case
convert to snake case by adding a `_` before each word. Also ensure that your
ENV variables are case insensitive.

# API Docs

## milieuFactory
```
milieuFactory(applicationName String, defaultConfig Object, opts Object) -> config Object
```

Internally creates an instance of Milieu instance and returns its compiled
config object. Accepts a `applicationName` and a `defaultConfig`. It also
optionally accepts an `opts` object to configure Milieu. See
[Milieu's load order](#milieu-load-order) to understand how the config object
is resolved. These does refer to milieuFactory as `milieuFactory` but It is
recommended that the name `milieu` be used instead as most users will not
interact with `Milieu` constructor or it's instance directly.

### Milieu Options
- `opts.argv` Pass a custom argv array. Defaults to `process.argv`.
- `opts.env`  Pass a custom env object. Defaults to `process.env`.
- `opts.platform`  Pass a custom platform string. Defaults to
  `process.platform`.
- `opts.unsetEnvValues` If true, deletes env values that belong to the config.
  Defaults to `false`.
- `opts.parseValues` If true, parses strings `'null'`, `'true'`, `'false'`,
  and `'NaN'` into `null`, `true`, `false`, and `NaN`. Defaults to `true`.
- `opts.useExplainFlag` If set to true Milieu will print the explain table when
  the flag `--explain-config` is set. Defaults to `true`.
- `opts.useLegacyEnvValues` Defaults to `false`.


```javascript
var milieuFactory = require('milieu');

var config = milieuFactory('application-name', {
  defaultKey: 'value'
});
```

## milieuFactory.explain

```
milieuFactory.explain(applicationName String, defaultConfig Object, opts Object) -> explanation Object
```

Returns an explanation object. Accepts the same arguments as
[milieuFactory](#milieuFactory).

```javascript
var milieuFactory = require('milieu');

var explanation = milieuFactory.explain('application-name', {
  defaultKey: 'value'
});
```

## milieuFactory.printExplainTable

```
milieuFactory.printExplainTable(applicationName String, defaultConfig Object, opts Object)
```

Prints an explanation table to stdout. Accepts the same arguments as
[milieuFactory](#milieuFactory).

```javascript
var milieuFactory = require('milieu');

// prints to stdout
milieuFactory.printExplainTable('application-name', {
  defaultKey: 'value'
});
```

## Milieu

```
new Milieu(applicationName String, defaultConfig Object, opts Object) -> Milieu
```

The Milieu constructor. Accepts the same arguments as
[milieuFactory](#milieuFactory).

```javascript
var Milieu = require('milieu').Milieu;

var milieu = new Milieu('application-name', {
  defaultKey: 'value'
});
```

## Milieu#toObject

```
milieu.toObject() -> config Object
```

Resolves the config object. Use this method to retrieve your config if using a
Milieu instance directly.

```javascript
var Milieu = require('milieu').Milieu;

var milieu = new Milieu('application-name', {
  defaultKey: 'value'
});

var config = milieu.toObject();
```

## Milieu#explain

```
milieu.explain() -> explanation Object
```

Returns an explanation object.

```javascript
var Milieu = require('milieu').Milieu;

var milieu = new Milieu('application-name', {
  defaultKey: 'value'
});

var explanation = milieu.explain();
```

## Milieu#printExplainTable

```
milieu.explain() -> explanation Object
```

Prints an explanation table to stdout.

```javascript
var Milieu = require('milieu').Milieu;

var milieu = new Milieu('application-name', {
  defaultKey: 'value'
});

// prints to stdout
milieu.printExplainTable();
```
