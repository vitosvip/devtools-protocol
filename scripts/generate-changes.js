'use script';

const fs = require('fs');

const simpleGit = require('simple-git/promise');
const objListDiff = require('obj-list-diff');

let results = '';

class Changeset {
  constructor(prev, curr) {
    this.prevDomains = prev.domains;
    this.currentDomains = curr.domains;
    this.diffs = [];
  }

  collectChanges() {
    // Any new/removed domains?
    const domainsDiff = objListDiff(this.prevDomains, this.currentDomains, {key: 'domain'});
    this.diffs.push({itemType: 'domains', domainName: '', diff: domainsDiff});

    // For each domain
    for (const domain of this.currentDomains) {
      const prevDomain = this.prevDomains.find(d => d.domain === domain.domain);

      //   Any new methods, events, types?
      const commandsDiff = objListDiff(prevDomain.commands, domain.commands, {key: 'name'});
      this.diffs.push({itemType: 'commands', domainName: domain.domain, diff: commandsDiff});

      const eventsDiff = objListDiff(prevDomain.events, domain.events, {key: 'name'});
      this.diffs.push({itemType: 'events', domainName: domain.domain, diff: eventsDiff});

      const typesDiff = objListDiff(prevDomain.types, domain.types, {key: 'id'});
      this.diffs.push({itemType: 'types', domainName: domain.domain, diff: typesDiff});

      // TODO: For each method
      //     Any new parameters?
      // uninmplemented.. we just now only say modified
    }
  }
}

class Formatter {
  static logDiff({itemType, domainName, diff}) {
    delete diff.discardedOrig;
    delete diff.discardedDest;
    delete diff.unchanged;

    // Note: domainsDiff.modified will include new methods in a domain
    if (itemType === 'domains') diff.modified = [];

    for (const changeType of Object.keys(diff)) {
      const changes = diff[changeType];
      if (changes.length === 0) continue;
      Formatter.outputChanges(domainName, itemType, changeType, changes);
    }
  }

  static outputChanges(domainName, itemType, changeType, changes) {
    results += `### ${changeType} ${itemType}: \`${domainName}\`\n`;

    const cleanType = type => type.replace('commands', 'methods').replace(/s$/, '');

    changes.forEach(change => {
      const itemName = Formatter.getKey(change);
      const linkHref = `https://chromedevtools.github.io/devtools-protocol/tot/${domainName}/#${cleanType(itemType)}-${itemName}`;
      results += `* [\`${change[itemName]}\`](${linkHref})\n`;
    });
    // TODO: For a new domain, we should log all methods/events added or removed
  }

  static getKey(obj) {
    if (obj.domain) return 'domain';
    if (obj.id) return 'id';
    if (obj.name) return 'name';
    throw new Error('Unknown object');
  }
}

class CommitCrawler {
  constructor() {
    this.remote = 'https://github.com/ChromeDevTools/devtools-protocol.git';
    this.path = './stubprotocolrepo';

    this.git = simpleGit(this.path);
    // await simpleGit().clone(this.remote, this.path);
  }

  async crawl() {
    const git = this.git;
    await git.reset('hard');
    await git.checkout('heads/master');
    const commitlog = await git.log();
    this.commitlogs = commitlog.all;

    for (let i = 0; i < this.commitlogs.length; i++) {
      // Skip the first commits of the repo.
      if (i >= this.commitlogs.length - 3) return;

      // Hack to quit early.
      if (i > 10) return;
      const commit = this.commitlogs[i];
      await this.checkoutAndDiff(commit, i);
    }
    // await this.commitlogs.forEach(async (commit, i) => {

    // });
  }

  async checkoutAndDiff(commit, i) {
    const readJSON = filename => JSON.parse(fs.readFileSync(`${this.path}/json/${filename}`, 'utf-8'));

    await this.git.checkout(commit.hash);

    const JSprotocol = 'js_protocol.json';
    const Browserprotocol = 'browser_protocol.json';

    const currentJSProtocol = readJSON(JSprotocol);
    const currentBrowserProtocol = readJSON(Browserprotocol);

    const previousCommit = this.commitlogs[i + 1];
    if (!previousCommit) return;
    await this.git.checkout(previousCommit.hash);

    // HACK
    // if (previousCommit.hash !== 'f2537966702cad6e91f04fafecc0fd339c707ad0') return; // audits domain added
    // if (previousCommit.hash !== '1da2f2124d8db26d6d6c7e64724e1f86ab6e138d') return; // queryobj method added to runtime
    // if (previousCommit.hash !== 'adb29482b8f2a850634c0720ab4a9c724d1af732') return; // typeprofile added somewhere.. i think?

    const previousJSProtocol = readJSON(JSprotocol);
    const previousBrowserProtocol = readJSON(Browserprotocol);

    const jsChange = new Changeset(previousJSProtocol, currentJSProtocol);
    const browserChange = new Changeset(previousBrowserProtocol, currentBrowserProtocol);

    jsChange.collectChanges();
    browserChange.collectChanges();

    if (jsChange.diffs.length > 0 || browserChange.diffs.length > 0) {
      results += `\n\n## ${commit.message}\n`;
      results += `https://github.com/ChromeDevTools/devtools-protocol/compare/${previousCommit.hash.slice(0, 7)}...${commit.hash.slice(0, 7)}\n`;
      jsChange.diffs.concat(browserChange.diffs).forEach(Formatter.logDiff);
    }
  }
}

(async function() {
  const crawler = new CommitCrawler();
  await crawler.crawl();
  console.log(results);
})();
