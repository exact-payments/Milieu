
var fs                  = require('fs');
var path                = require('path');
var explainTableSrcPath = path.join(__dirname, 'explain-table.txt');
var explainTableSrc     = fs.readFileSync(explainTableSrcPath, 'utf8');

module.exports = function() {
  return explainTableSrc;
};
