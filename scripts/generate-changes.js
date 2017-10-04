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

    //   For each method
    //     Any new parameters?
    // uninmplemented
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
  // console.log(changes);
}


(async function() {
  // await simpleGit().clone(remote, path);
  const git = simpleGit(path);
  await git.checkout('heads/master');
  const commitlog = await git.log();
  const commitlogs = commitlog.all;

  commitlogs.forEach(async (commit, i) => {
    if (i > 5) return;
    // hack to quit early.
    // 12 has a new domain added
    // 10 has a new method added to runtime 1da2f2124d8db26d6d6c7e64724e1f86ab6e138d
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
    // const diff = dodiff.detailedDiff(previousProtocol, currentProtocol);
    // const diff = simpleDiff(previousProtocol, currentProtocol, {
    //   idProps: {
    //     'domains': 'domain',
    //     'domains.*.commands': 'name',
    //     'domains.*.events': 'name',
    //     'domains.*.types': 'id',
    //   }
    // });
    // const diff = objListDiff(previousProtocol.domains, currentProtocol.domains, 'domain');
    console.log(`\n\n## ${commit.message}`);
    // console.log(`# ${commit.hash.slice(0, 7)}`);
    // console.log(`# Diff of ${previousCommit.hash}...${commit.hash}:`);
    console.log(`https://github.com/ChromeDevTools/devtools-protocol/compare/${previousCommit.hash.slice(0, 7)}...${commit.hash.slice(0, 7)}`);

    // Do i need to normalize the sorted order of all objects in arrays?
    collectChanges(previousJSProtocol.domains, currentJSProtocol.domains);
    collectChanges(previousBrowserProtocol.domains, currentBrowserProtocol.domains);

    // console.dir(diff, {colors: true, depth: 2});
    return;

    console.log('now formatted:');

    if (Object.keys(diff.added).length > 0) {
      console.log('## Added items:');
      logChanges(diff.added, currentProtocol);
    }

    if (Object.keys(diff.deleted).length > 0) {
      console.log('## Deleted items:');
      logChanges(diff.deleted, previousProtocol);
    }

    if (Object.keys(diff.updated).length > 0) {
      console.log('## Updated items:');
      logChanges(diff.updated, currentProtocol);
    }

    console.log('----------');
    console.log('----------');
    console.log('----------');
    console.log('----------');

    // console.log(previousProtocol.domains.find(d => d.domain === 'Memory').commands.map(c => c.name));
  });
  // console.log(log);
})();

// # Deleted domain
// # Deleted methods
// # Deleted events/types
// # Deleted parameters

// # Added domain
// # Added methods
// # Added events/types
// # Added parameters

// # modified?
