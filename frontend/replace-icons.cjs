const fs = require('fs');
const path = require('path');

const mapping = {
  AlertCircle: 'ExclamationCircleIcon',
  Check: 'CheckIcon',
  Info: 'InformationCircleIcon',
  Loader2: 'ArrowPathIcon',
  RefreshCw: 'ArrowPathIcon',
  ArrowRight: 'ArrowRightIcon',
  Activity: 'BoltIcon',
  ArrowDownUp: 'ArrowsUpDownIcon',
  Copy: 'DocumentDuplicateIcon',
  Terminal: 'CodeBracketSquareIcon',
  Menu: 'Bars3Icon',
  Unlock: 'LockOpenIcon',
  Wallet: 'WalletIcon',
  X: 'XMarkIcon',
  ChevronLeft: 'ChevronLeftIcon',
  ChevronRight: 'ChevronRightIcon',
  ChevronUp: 'ChevronUpIcon',
  ChevronDown: 'ChevronDownIcon',
  Circle: 'StopCircleIcon',
  Search: 'MagnifyingGlassIcon',
  MoreHorizontal: 'EllipsisHorizontalIcon',
  CopyIcon: 'DocumentDuplicateIcon',
  ShieldCheck: 'ShieldCheckIcon',
  ShieldAlert: 'ShieldExclamationIcon',
  ArrowUpRight: 'ArrowTopRightOnSquareIcon',
  Code2: 'CodeBracketIcon',
  Cpu: 'CpuChipIcon',
  Shield: 'ShieldCheckIcon',
  Zap: 'BoltIcon',
  Asterisk: 'StarIcon'
};

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(dirPath);
  });
}

walkDir('src', function(filePath) {
  if (!filePath.endsWith('.tsx') && !filePath.endsWith('.ts')) return;

  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;

  let newContent = content.replace(/import\s*\{\s*([^}]+)\s*\}\s*from\s*['"]lucide-react['"];?/g, (match, importsStr) => {
    const icons = importsStr.split(',').map(s => s.trim()).filter(Boolean);
    const heroiconsStr = icons.map(iconName => {
      // handles `import { LucideIcon } from "lucide-react"`
      if (iconName === 'LucideIcon' || iconName === 'LucideProps') return '';
      // handle aliases `ArrowRight as ArrowFoo`
      if (iconName.includes(' as ')) iconName = iconName.split(' as ')[0].trim();
      
      let newName = mapping[iconName] || iconName + 'Icon';
      return newName;
    }).filter(Boolean).join(', ');
    
    if (!heroiconsStr) return '';
    return `import { ${heroiconsStr} } from "@heroicons/react/24/outline";`;
  });

  // Now replace all JSX elements using the mapping
  const regexIterator = importsStr => {
      const icons = importsStr.split(',').map(s => s.trim()).filter(Boolean);
      icons.forEach(iconName => {
        if (iconName === 'LucideIcon' || iconName === 'LucideProps') return;
        if (iconName.includes(' as ')) iconName = iconName.split(' as ')[0].trim();
        const heroName = mapping[iconName] || iconName + 'Icon';
        // Replace <IconName
        newContent = newContent.replace(new RegExp(`<${iconName}(\\s|>)`, 'g'), `<${heroName}$1`);
        // Replace </IconName>
        newContent = newContent.replace(new RegExp(`<\\/${iconName}>`, 'g'), `</${heroName}>`);
      });
  };

  // Extract all the lucide imports to replace tags accurately
  const importRegex = /import\s*\{\s*([^}]+)\s*\}\s*from\s*['"]lucide-react['"];?/g;
  let m;
  while ((m = importRegex.exec(content)) !== null) {
      regexIterator(m[1]);
  }

  if (originalContent !== newContent) {
    fs.writeFileSync(filePath, newContent);
    console.log(`Updated ${filePath}`);
  }
});
