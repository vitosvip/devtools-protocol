'use script';

const fs = require('fs');

const simpleGit = require('simple-git/promise');
const dodiff = require('deep-object-diff');
const simpleDiff = require('simple-diff');
const objListDiff = require('obj-list-diff');

const remote = 'https://github.com/ChromeDevTools/devtools-protocol.git';
const path = './stubprotocolrepo';

function readJSON(filename) {
  const data = fs.readFileSync(`${path}/json/${filename}`, 'utf-8');
  return JSON.parse(data);
}

function getKey(obj) {
  if (obj.domain) return 'domain';
  if (obj.id) return 'id';
  if (obj.name) return 'name';
  throw new Error('Unknown object');
}

function logDiff(itemType, domainName, diff) {
  delete diff.discardedOrig;
  delete diff.discardedDest;
  delete diff.unchanged;

    // domainsDiff.modified will include new methods in a domain
  if (itemType === 'domains') diff.modified = [];

  for (const changeType of Object.keys(diff)) {
    const changes = diff[changeType];
    if (changes.length === 0) continue;
    // console.log(domainName, itemType, changeType, changes);
    outputChanges(domainName, itemType, changeType, changes);
  }
}

function collectChanges(prevDomains, currentDomains) {
  // Any new/removed domains?
  const domainsDiff = objListDiff(prevDomains, currentDomains, {key: 'domain'});
  logDiff('domains', '', domainsDiff);


  // For each domain
  for (const domain of currentDomains) {
    const prevDomain = prevDomains.find(d => d.domain === domain.domain);

    //   Any new methods, events, types?
    const commandsDiff = objListDiff(prevDomain.commands, domain.commands, {key: 'name'});
    logDiff('commands', domain.domain, commandsDiff);

    const eventsDiff = objListDiff(prevDomain.events, domain.events, {key: 'name'});
    logDiff('events', domain.domain, eventsDiff);

    const typesDiff = objListDiff(prevDomain.types, domain.types, {key: 'id'});
    logDiff('types', domain.domain, typesDiff);

    // TODO: For each method
    //     Any new parameters?
    // uninmplemented.. we just now only say modified
  }
}

function outputChanges(domainName, itemType, changeType, changes) {
  const cleanType = type => type.replace('commands', 'methods').replace(/s$/, '');

  console.log(`### ${changeType} ${itemType}: \`${domainName}\``);
  changes.forEach(change => {
    const itemName = getKey(change);
    const linkHref = `https://chromedevtools.github.io/devtools-protocol/tot/${domainName}/#${cleanType(itemType)}-${itemName}`;
    console.log(`* [\`${change[itemName]}\`](${linkHref})`);
  });
  // TODO: For a new domain, we should log all methods/events added or removed
}


(async function() {
  // await simpleGit().clone(remote, path);
  const git = simpleGit(path);
  await git.checkout('heads/master');
  const commitlog = await git.log();
  const commitlogs = commitlog.all;

  commitlogs.forEach(async (commit, i) => {
    // Skip the first commits of the repo.
    if (i >= (commitlogs.length - 3)) return;


    // hack to quit early.
    // if (i != 10) return;
    // if (i < 7 || i > 11) return;

    await git.checkout(commit.hash);

    const JSprotocol = 'js_protocol.json';
    const Browserprotocol = 'browser_protocol.json';

    const currentJSProtocol = readJSON(JSprotocol);
    const currentBrowserProtocol = readJSON(Browserprotocol);

    const previousCommit = commitlogs[i + 1];
    if (!previousCommit) return;
    await git.checkout(previousCommit.hash);

    // if (previousCommit.hash !== 'f2537966702cad6e91f04fafecc0fd339c707ad0') return; // audits domain added
    // if (previousCommit.hash !== '1da2f2124d8db26d6d6c7e64724e1f86ab6e138d') return; // queryobj method added to runtime
    // if (previousCommit.hash !== 'adb29482b8f2a850634c0720ab4a9c724d1af732') return; // typeprofile added somewhere.. i think?

    const previousJSProtocol = readJSON(JSprotocol);
    const previousBrowserProtocol = readJSON(Browserprotocol);

    console.log(`\n\n## ${commit.message}`);
    console.log(`https://github.com/ChromeDevTools/devtools-protocol/compare/${previousCommit.hash.slice(0, 7)}...${commit.hash.slice(0, 7)}`);

    // Do i need to normalize the sorted order of all objects in arrays?
    collectChanges(previousJSProtocol.domains, currentJSProtocol.domains);
    collectChanges(previousBrowserProtocol.domains, currentBrowserProtocol.domains);
  });

})();

