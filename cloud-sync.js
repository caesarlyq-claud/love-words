(function () {
  'use strict';
  var API = window.LOVE_WORDS_API || 'https://vocab-progress.caesarlyq.workers.dev';
  var originalBooks = window.BOOKS_CONFIG || (typeof BOOKS_CONFIG !== 'undefined' ? BOOKS_CONFIG : []);
  if (window.SHANGHAI_2027_DATA && originalBooks.length) {
    originalBooks.unshift({section:'🎯 上海中考',books:[{
      id:'shanghai_2027',icon:'🏙️',title:'2027上海初中英语考纲',
      desc:'依据《2027年上海市初中英语考纲词汇用法手册》校对整理 · 1785词 · 60单元',
      badge:'已校对',badgeCls:'avail',units:60,wordData:window.SHANGHAI_2027_DATA
    }]});
  }

  function localKey(account) { return 'love_words_progress_' + account; }
  function readKey(key) { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch (_) { return null; } }
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function mergeLearning(base, incoming) {
    base = base || {}; incoming = incoming || {};
    var out = Object.assign({}, base, incoming), progress = {};
    var left = base.progress || {}, right = incoming.progress || {};
    Object.keys(Object.assign({}, left, right)).forEach(function(book) {
      progress[book] = Object.assign({}, left[book] || {});
      Object.keys(right[book] || {}).forEach(function(key) {
        var a = progress[book][key], b = right[book][key];
        if (!a) { progress[book][key] = b; return; }
        var at = Date.parse(a.updatedAt || a.finishedAt || '') || 0;
        var bt = Date.parse(b.updatedAt || b.finishedAt || '') || 0;
        if (at || bt) progress[book][key] = bt >= at ? b : a;
        else progress[book][key] = Object.assign({}, a, b, {
          pct: Math.max(Number(a.pct)||0, Number(b.pct)||0), done: !!(a.done || b.done)
        });
      });
    });
    out.progress = progress;
    out.wrong_bank = Object.assign({}, base.wrongBank || {}, base.wrong_bank || {}, incoming.wrongBank || {}, incoming.wrong_bank || {});
    out.wrongBank = out.wrong_bank;
    out.trophies = Math.max(Number(base.trophies)||0, Number(incoming.trophies)||0);
    delete out.pwd; delete out.password;
    return out;
  }
  function localRead(account) { return mergeLearning(readKey('wiz_p_' + account), readKey(localKey(account))); }
  function localWrite(account, data) { localStorage.setItem(localKey(account), JSON.stringify(data)); }
  function status(message, failed) {
    if (!document.body || !document.createElement) return;
    var el = document.getElementById('cloud-sync-status');
    if (!el) {
      el = document.createElement('div'); el.id = 'cloud-sync-status'; el.setAttribute('role','status');
      el.style.cssText = 'position:fixed;bottom:6px;left:8px;right:8px;padding:8px 12px;border-radius:8px;background:#fff;color:#334155;box-shadow:0 1px 8px #0002;z-index:500;font-size:13px';
      document.body.appendChild(el);
    }
    el.replaceChildren(document.createTextNode(message));
    if (failed) {
      var button = document.createElement('button'); button.textContent = '重试同步';
      button.onclick = function(){ window.saveProg(); }; el.appendChild(button);
    }
  }
  async function request(path, options) {
    var response = await fetch(API + path, Object.assign({cache:'no-store'}, options));
    if (!response.ok) throw new Error(response.status === 401 ? (path === '/login' ? '账号或密码验证未通过（HTTP 401）' : '登录已失效，请重新登录') : '登录或同步服务异常（HTTP ' + response.status + '）');
    return response.status === 204 ? null : response.json();
  }
  function contains(saved, expected) {
    if (expected && typeof expected === 'object') return !!saved && Object.keys(expected).every(function(k){return contains(saved[k], expected[k]);});
    return saved === expected;
  }
  window.loveWordsCloud = {
    async login(account, password) {
      return request('/login', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({account:account,password:password})});
    },
    async load(account, token) {
      return request('/progress/' + encodeURIComponent(account), {headers:{Authorization:'Bearer ' + token}});
    },
    async save(account, token, data) {
      // Never overwrite cloud progress when its initial read failed.
      var previous = await this.load(account, token);
      var merged = mergeLearning(previous && previous.data, data);
      // wrong_bank is the canonical mutable map used by the original quiz.
      merged.wrongBank = data.wrong_bank || data.wrongBank || {};
      merged.wrong_bank = merged.wrongBank;
      await request('/progress/' + encodeURIComponent(account), {method:'PUT',headers:{'Content-Type':'application/json',Authorization:'Bearer ' + token},body:JSON.stringify(merged)});
      var check = await this.load(account, token);
      return {confirmed: !!(check && check.data && contains(check.data.progress, merged.progress))};
    },
    localRead: localRead
  };

  window.doLogin = async function (event) {
    if (event && event.preventDefault) event.preventDefault();
    var account = document.getElementById('inp-name').value.trim();
    var password = document.getElementById('inp-pwd').value;
    if (!account || !password) return;
    try {
      var session = await window.loveWordsCloud.login(account, password);
      var local = localRead(account);
      var remote;
      try { remote = await window.loveWordsCloud.load(account, session.token); }
      catch (_) { remote = null; }
      G.account = account; G.cloudToken = session.token;
      G.user = Object.assign({}, session.student, mergeLearning(remote && remote.data, local));
      setNav(); showBooks();
      if (remote) await window.saveProg();
      else status('云端记录暂未读取成功。当前使用本机记录，请重试同步。', true);
    } catch (error) {
      if (typeof flashInput === 'function') flashInput('inp-pwd', error.message || '登录失败，请检查网络后重试');
    }
  };

  // The legacy single-file site registers its login handlers before this file loads.
  // Capture the events first so authentication always goes through the private Worker.
  var loginButton = document.getElementById('login-btn');
  if (loginButton) loginButton.addEventListener('click', function (event) {
    event.preventDefault(); event.stopImmediatePropagation(); window.doLogin(event);
  }, true);
  ['inp-name','inp-pwd'].forEach(function (id) {
    var input = document.getElementById(id);
    if (input) input.addEventListener('keydown', function (event) {
      if (event.key === 'Enter') {
        event.preventDefault(); event.stopImmediatePropagation(); window.doLogin(event);
      }
    }, true);
  });

  var saving = Promise.resolve();
  var pending = {};
  function enqueue(account, token, snapshot) {
    var key = account + ':' + token;
    if (pending[key]) { pending[key].snapshot = snapshot; return pending[key].promise; }
    var job = {snapshot:snapshot};
    pending[key] = job;
    job.promise = saving.catch(function(){}).then(function(){
      // Coalesce rapid answers and respect the KV per-key write interval.
      return new Promise(function(resolve){setTimeout(resolve, 1200);});
    }).then(function(){
      delete pending[key];
      return window.loveWordsCloud.save(account, token, job.snapshot);
    });
    saving = job.promise;
    return job.promise;
  }
  window.saveProg = function () {
    if (!G.user || !G.account) return Promise.resolve({confirmed:false});
    var account = G.account, token = G.cloudToken;
    G.user.lastSeen = new Date().toISOString();
    G.user.wrongBank = G.user.wrong_bank || G.user.wrongBank || {};
    G.user.wrong_bank = G.user.wrongBank;
    var snapshot = clone(G.user);
    try { localWrite(account, snapshot); }
    catch (_) { status('本机存储空间不足，请勿关闭页面，联网后重试。', true); }
    if (!token) return Promise.resolve({confirmed:false});
    status('成绩已保存在本机，正在同步…');
    var resultPromise = enqueue(account, token, snapshot).then(function(result){
      if (G.account === account) status(result.confirmed ? '云端已核验保存，老师刷新后台即可查看。' : '已提交，云端仍在更新。稍后重试核验，暂勿清除本机记录。', !result.confirmed);
      return result;
    }).catch(function(error){
      if (G.account === account) status('成绩已保存在本机；' + error.message + '。', true);
      // Existing quizzes do not catch save errors; keep their results screen usable.
      return {confirmed:false, error:error.message};
    });
    return resultPromise;
  };
})();
