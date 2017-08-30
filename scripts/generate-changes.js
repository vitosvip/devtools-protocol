'use script';

const fs = require('fs');

const simpleGit = require('simple-git/promise');
const dodiff = require('deep-object-diff');
const simpleDiff = require('simple-diff');
const objListDiff = require('obj-list-diff');

const remote = 'https://github.com/ChromeDevTools/devtools-protocol.git';
const path = './stubprotocolrepo';

function readJSON() {
  const data = fs.readFileSync(`${path}/json/browser_protocol.json`, 'utf-8');
  return JSON.parse(data);
}

function collectChanges(prevDomains, currentDomains) {
  const diff = objListDiff(prevDomains, currentDomains, 'domain');
  delete diff.discardedOrig;
  delete diff.discardedDest;
  console.log('domains', diff);

  for (const domain of currentDomains) {
    if (domain.domain !== 'Memory') continue;
    const prevDomain = prevDomains.find(d => d.domain === domain.domain);
    console.dir({
      prev: prevDomain.commands, curr: domain.commands
    }, {colors: true, depth: 7});
    const diffA = objListDiff(prevDomain.commands, domain.commands, ['name']);
    delete diffA.discardedOrig;
    delete diffA.discardedDest;
    console.log('methods', diffA);
  }
}
function logChanges(changeObj, protocolRef) {
  for (const domainKey of Object.keys(changeObj.domains)) {
    const domain = protocolRef.domains[domainKey];
    const domainName = domain.domain;
    const commands = changeObj.domains[domainKey].commands;
    const events = changeObj.domains[domainKey].events;

    console.log(domainKey, commands);

    for (const methodKey of Object.keys(commands || {})) {
      const methodName = domain.commands[methodKey].name;
      console.log(`### Method: ${domainName}.${methodName}`);
      console.dir(commands[methodKey], {colors: true, depth: 7});
    }
    for (const eventKey of Object.keys(events || {})) {
      const eventName = domain.events[eventKey].name;
      console.log(`### Event: ${domainName}.${eventName}`);
      console.dir(events[eventKey], {colors: true, depth: 7});
    }
  }
}

(async function() {
  // await simpleGit().clone(remote, path);
  const git = simpleGit(path);
  await git.checkout('heads/master');
  const commitlog = await git.log();
  const commitlogs = commitlog.all;

  commitlogs.forEach(async (commit, i) => {
    if (i > 1) return;
    // if (i < 5 || i > 8) return;

    await git.checkout(commit.hash);
    const currentProtocol = readJSON();

    const previousCommit = commitlogs[i + 1];
    if (!previousCommit) return;
    await git.checkout(previousCommit.hash);
    const previousProtocol = readJSON();
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

    collectChanges(previousProtocol.domains, currentProtocol.domains);

    console.log(`# Diff of ${previousCommit.hash}...${commit.hash}:`);
    console.log(`https://github.com/ChromeDevTools/devtools-protocol/compare/${previousCommit.hash}...${commit.hash}`);
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
