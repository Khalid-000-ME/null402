require('ts-node').register({ transpileOnly: true, compilerOptions: { module: 'commonjs', esModuleInterop: true } });
require('tsconfig-paths').register();
const page = require('./src/app/page.tsx');
console.log(page);
