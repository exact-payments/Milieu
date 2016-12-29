const fs                  = require('fs');
const path                = require('path');
const explainTableSrcPath = path.join(__dirname, 'explain-table.txt');
const explainTableSrc     = fs.readFileSync(explainTableSrcPath, 'utf8');


module.exports = () => explainTableSrc;
