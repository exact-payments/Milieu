var colors = require('colors/safe');
var Table  = require('cli-table2');


colors.setTheme({
  flag       : ['red'],
  environment: ['yellow'],
  config     : ['cyan'],
  null       : ['red'],
  boolean    : ['cyan'],
  number     : ['yellow'],
  string     : ['green'],
  defaults   : ['white', 'bgBlack']
});

function explainTable(applicationName, explanation) {
  var flattenedExplanation = flattenExplanation('', {}, explanation);

  var table = new Table({
    head : ['Path', 'Value', 'Source'],
    chars: { mid: '', 'left-mid': '', 'mid-mid': '', 'right-mid': '' },
    style: { head: ['white', 'bold'] }
  });

  for (var jsonPath in flattenedExplanation) {
    var valueExplaination = flattenedExplanation[jsonPath];
    var color;
    switch (valueExplaination.src) {
      case 'flag'       : color = 'flag';        break;
      case 'environment': color = 'environment'; break;
      case 'defaults'   : color = 'defaults';    break;
      default           : color = 'config';      break;
    }

    var src = valueExplaination.src;
    var val = valueExplaination.val;
    var valColor;
    switch (typeof val) {
      case 'string'     : valColor = 'string';  val = '"' + val + '"'; break;
      case 'number'     : valColor = 'number';  break;
      case 'boolean'    : valColor = 'boolean'; break;
      case 'object'     : valColor = 'null';    break;
      default           : valColor = 'white';   break;
    }

    var row = {};
    row[jsonPath] = [colors[valColor](val), colors[color](src)];
    table.push(row);
  }

  var title = 'Configuration Explanation for ' + applicationName;

  console.log();
  console.log('  ' + colors.bold.underline(title));
  console.log(table.toString());
  console.log();
}

function flattenExplanation(basePath, target, ctx) {
  var isArray = typeof ctx.length === 'number';
  for (var key in ctx) {
    var pathKey = isArray ? '[' + key + ']' : (basePath && '.') + key;
    var currentPath = basePath + pathKey;
    if (ctx[key] && typeof ctx[key] === 'object' && (
      ctx[key].src === undefined || ctx[key].val === undefined
    )) {
      flattenExplanation(currentPath, target, ctx[key]);
    } else {
      target[currentPath] = ctx[key];
    }
  }
  return target;
};

module.exports = explainTable;
