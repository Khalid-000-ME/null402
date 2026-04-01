const content = `import { Loader2, ArrowRight } from "lucide-react";
export default function Foo() { return <Loader2 /> }`;
const mapping = { Loader2: 'ArrowPathIcon', ArrowRight: 'ArrowRightIcon' };

let newContent = content.replace(/import\s*\{\s*([^}]+)\s*\}\s*from\s*['"]lucide-react['"]/g, (match, importsStr) => {
  const icons = importsStr.split(',').map(s => s.trim()).filter(Boolean);
  const heroiconsStr = icons.map(iconName => mapping[iconName]).filter(Boolean).join(', ');
  if (!heroiconsStr) return '';
  return `import { ${heroiconsStr} } from "@heroicons/react/24/outline"`;
});

Object.keys(mapping).forEach(lucideName => {
  const heroName = mapping[lucideName];
  newContent = newContent.replace(new RegExp(`<${lucideName}(\\s|>)`, 'g'), `<${heroName}$1`);
  newContent = newContent.replace(new RegExp(`<\\/${lucideName}>`, 'g'), `</${heroName}>`);
});

console.log(newContent);
