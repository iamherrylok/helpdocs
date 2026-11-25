import fs from 'node:fs';
import path from 'node:path';

const manifestFile = process.env.MANIFEST_FILE;
if (!manifestFile) {
  throw new Error('Missing MANIFEST_FILE environment variable.');
}

const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
const {
  packageSlug,
  packageName,
  docsRootPath,
  docsJsonPath = 'docs.json',
  navigationLanguage,
  navigationTab,
  navigationAnchorGroup = 'Custom Commands',
  articles = []
} = manifest;

for (const article of articles) {
  const fullPath = path.resolve(article.filePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, article.markdown, 'utf8');
}

const docsJson = JSON.parse(fs.readFileSync(docsJsonPath, 'utf8'));
const anchorGroup = findOrCreateAnchorGroup(
  docsJson.navigation,
  navigationLanguage,
  navigationTab,
  navigationAnchorGroup
);

const packagePrefix = `${docsRootPath.replace(/^\/+|\/+$/g, '')}/${packageSlug}/`;
const newPagePaths = articles.map(a => a.pagePath);

let existingPkgGroup = anchorGroup.pages.find(
  item =>
    typeof item === 'object' &&
    item !== null &&
    Array.isArray(item.pages) &&
    item.pages.some(p => typeof p === 'string' && p.startsWith(packagePrefix))
);

if (existingPkgGroup) {
  existingPkgGroup.group = packageName;
  const merged = [...existingPkgGroup.pages];
  for (const p of newPagePaths) {
    if (!merged.includes(p)) merged.push(p);
  }
  existingPkgGroup.pages = merged;
} else {
  anchorGroup.pages.push({
    group: packageName,
    pages: newPagePaths
  });
}

fs.writeFileSync(docsJsonPath, `${JSON.stringify(docsJson, null, 2)}\n`, 'utf8');
console.log(`Updated ${articles.length} articles and ${docsJsonPath} for ${packageSlug}.`);

function findOrCreateAnchorGroup(navigation, lang, tab, anchorName) {
  let scope = navigation;

  if (lang && Array.isArray(scope?.languages)) {
    scope = scope.languages.find(l => l.language === lang) ?? scope;
  }
  if (tab && Array.isArray(scope?.tabs)) {
    scope = scope.tabs.find(t => t.tab === tab) ?? scope;
  }

  const groupsContainer = resolveGroupsArray(scope);
  if (!groupsContainer) {
    throw new Error('Could not locate groups array in docs.json navigation.');
  }

  let anchor = groupsContainer.find(g => g.group === anchorName);
  if (!anchor) {
    anchor = { group: anchorName, pages: [] };
    groupsContainer.push(anchor);
  }
  if (!Array.isArray(anchor.pages)) {
    anchor.pages = [];
  }
  return anchor;
}

function resolveGroupsArray(node) {
  if (!node) return null;
  if (Array.isArray(node)) return node;
  if (Array.isArray(node.groups)) return node.groups;
  if (Array.isArray(node.tabs) && node.tabs.length > 0) return resolveGroupsArray(node.tabs[0]);
  if (Array.isArray(node.languages) && node.languages.length > 0) return resolveGroupsArray(node.languages[0]);
  return null;
}
