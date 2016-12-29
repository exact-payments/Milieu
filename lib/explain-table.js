const colors = require('colors/safe');
const Table  = require('cli-table2');


colors.setTheme({
  flag       : ['red'],
  environment: ['yellow'],
  config     : ['cyan'],
  null       : ['red'],
  boolean    : ['cyan'],
  number     : ['yellow'],
  string     : ['green'],
  defaults   : ['white', 'bgBlack'],
});

function flattenExplanation(basePath, target, ctx) {
  const isArray = typeof ctx.length === 'number';
  for (const key in ctx) {
    const pathKey = isArray ? `[${key}]` : (basePath && '.') + key;
    const currentPath = basePath + pathKey;
    if (ctx[key] && typeof ctx[key] === 'object' && (
      ctx[key].src === undefined || ctx[key].val === undefined
    )) {
      flattenExplanation(currentPath, target, ctx[key]);
    } else {
      target[currentPath] = ctx[key];
    }
  }
  return target;
}

function explainTable(applicationName, explanation) {
  const flattenedExplanation = flattenExplanation('', {}, explanation);

  const table = new Table({
    head : ['Path', 'Value', 'Source'],
    chars: { mid: '', 'left-mid': '', 'mid-mid': '', 'right-mid': '' },
    style: { head: ['white', 'bold'] },
  });

  for (const jsonPath in flattenedExplanation) {
    const valueExplaination = flattenedExplanation[jsonPath];
    let   color;
    switch (valueExplaination.src) {
    case 'flag'       : color = 'flag';        break;
    case 'environment': color = 'environment'; break;
    case 'defaults'   : color = 'defaults';    break;
    default           : color = 'config';      break;
    }

    const src = valueExplaination.src;
    let   val = valueExplaination.val;
    let   valColor;
    switch (typeof val) {
    case 'string':
      valColor = 'string';
      val      = `"${val}"`;
      break;
    case 'number'     : valColor = 'number';  break;
    case 'boolean'    : valColor = 'boolean'; break;
    case 'object'     : valColor = 'null';    break;
    default           : valColor = 'white';   break;
    }

    const row = {};
    row[jsonPath] = [colors[valColor](val), colors[color](src)];
    table.push(row);
  }

  const title = `Configuration Explanation for ${applicationName}`;

  /* eslint-disable no-console */
  console.log();
  console.log(`  ${colors.bold.underline(title)}`);
  console.log(table.toString());
  console.log();
  /* eslint-enable no-console */
}

module.exports = explainTable;
