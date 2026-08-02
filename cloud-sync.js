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
  function localRead(account) { try { return JSON.parse(localStorage.getItem(localKey(account)) || 'null'); } catch (_) { return null; } }
  function localWrite(account, data) { localStorage.setItem(localKey(account), JSON.stringify(data)); }
  async function request(path, options) {
    var response = await fetch(API + path, options);
    if (!response.ok) throw new Error('同步服务返回 ' + response.status);
    return response.status === 204 ? null : response.json();
  }

  window.loveWordsCloud = {
    async login(account, password) {
      return request('/login', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({account:account,password:password})});
    },
    async load(account, token) {
      return request('/progress/' + encodeURIComponent(account), {headers:{Authorization:'Bearer ' + token}});
    },
    async save(account, token, data) {
      localWrite(account, data);
      return request('/progress/' + encodeURIComponent(account), {method:'PUT',headers:{'Content-Type':'application/json',Authorization:'Bearer ' + token},body:JSON.stringify(data)});
    },
    localRead: localRead
  };

  var oldLogin = window.doLogin;
  window.doLogin = async function (event) {
    if (event && event.preventDefault) event.preventDefault();
    var account = document.getElementById('inp-name').value.trim();
    var password = document.getElementById('inp-pwd').value;
    if (!account || !password) return;
    try {
      var session = await window.loveWordsCloud.login(account, password);
      var local = localRead(account) || {};
      G.account = account;
      G.user = Object.assign({}, session.student, local);
      G.user.progress = G.user.progress || {};
      G.user.wrongBank = G.user.wrongBank || G.user.wrong_bank || {};
      G.cloudToken = session.token;
      try {
        var remote = await window.loveWordsCloud.load(account, session.token);
        if (remote && remote.data) G.user = Object.assign(G.user, remote.data);
      } catch (_) {}
      setNav(); showBooks();
      saveProg();
    } catch (error) {
      if (typeof flashInput === 'function') flashInput('inp-pwd', '账号或密码错误，或同步服务未部署');
      else if (oldLogin) oldLogin(event);
    }
  };

  var saving = Promise.resolve();
  window.saveProg = function () {
    if (!G.user || !G.account) return Promise.resolve();
    G.user.lastSeen = new Date().toISOString();
    localWrite(G.account, G.user);
    if (!G.cloudToken) return Promise.resolve();
    saving = saving.catch(function(){}).then(function(){return window.loveWordsCloud.save(G.account,G.cloudToken,G.user);});
    return saving;
  };
})();
