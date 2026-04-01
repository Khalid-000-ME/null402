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
  MoreHorizontal: 'EllipsisHorizontalIcon'
};

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

walkDir('src', function(filePath) {
  if (!filePath.endsWith('.tsx') && !filePath.endsWith('.ts')) return;

  let content = fs.readFileSync(filePath, 'utf8');
  let newContent = content.replace(/import\s*\{\s*([^}]+)\s*\}\s*from\s*['"]lucide-react['"]/g, (match, importsStr) => {
    const icons = importsStr.split(',').map(s => s.trim()).filter(Boolean);
    const heroiconsStr = icons.map(icon => {
      let iconName = icon;
      if (iconName.includes(' as ')) {
        const parts = iconName.split(' as ');
        iconName = parts[0].trim();
      }
      if (iconName === 'LucideIcon' || iconName === 'LucideProps') return '';
      if (mapping[iconName]) return mapping[iconName];
      console.log(`Missing mapping for ${iconName} in ${filePath}`);
      return `${iconName}Icon`;
    }).filter(Boolean).join(', ');
    
    if (!heroiconsStr) return '';
    return `import { ${heroiconsStr} } from "@heroicons/react/24/outline"`;
  });

  // Now replace all JSX elements using the mapping
  Object.keys(mapping).forEach(lucideName => {
    const heroName = mapping[lucideName];
    // Replace <IconName
    newContent = newContent.replace(new RegExp(`<${lucideName}(\\s|>)`, 'g'), `<${heroName}$1`);
    // Replace </IconName>
    newContent = newContent.replace(new RegExp(`<\\/${lucideName}>`, 'g'), `</${heroName}>`);
  });

  if (content !== newContent) {
    fs.writeFileSync(filePath, newContent);
    console.log(`Updated ${filePath}`);
  }
});
