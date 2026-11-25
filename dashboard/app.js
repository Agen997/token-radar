// Token Radar's dashboard (radar-2). It reads window.RADAR (written beside dashboard/ by main.ts)
// and renders the ranked board, a filterable table, a per-protocol detail drawer with the model's
// own inputs and the protocol's farm plan, a live-token view and a model sandbox. No network: every
// byte it shows is in data.js. The page recomputes each row from the snapshot figures and checks the
// number board.json carries, so the page's code and the board's data are visibly the same arithmetic.
(function () {
  'use strict';

  var DATA = window.RADAR;
  var app = document.getElementById('board');
  if (!DATA || !app) return;
  var MODEL = DATA.model;
  var state = { q: '', category: 'all', chain: 'all', sig: 'all', watch: false, tab: 'board', sort: 'implied', dir: -1, selected: null };

  var usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return usd.format(n);
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  // The model in one function: growth, maturity and breadth from the row's own figures.
  function impliedOf(row, model) {
    var growth = Math.min(model.growth_cap, Math.max(model.growth_floor, row.change_7d === null || row.change_7d === undefined ? 0 : row.change_7d));
    var growthMult = 1 + (growth / 100) * model.growth_weight;
    var age = row.age_days === null || row.age_days === undefined ? model.unknown_age_days : row.age_days;
    var maturity = model.maturity_floor + (Math.min(Math.max(age, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
    var breadth = 1 + model.breadth_weight * Math.log(Math.max(1, row.chains.length));
    return { implied: Math.max(1, Math.round(row.tvl_usd * model.base_multiple * growthMult * maturity * breadth)), growth: growth, growthMult: growthMult, maturity: maturity, breadth: breadth, age: age };
  }

  // The farm plan is the same derivation main.ts writes to board.json: category, chains, TVL, age.
  function capitalFor(row) {
    if (row.tvl_usd >= 5000000000) return 250;
    if (row.tvl_usd >= 1000000000) return 150;
    if (row.tvl_usd >= 100000000) return 100;
    return 50;
  }
  function holdFor(age) {
    if (age === null || age === undefined) return 30;
    if (age < 180) return 60;
    if (age < 365) return 45;
    return 30;
  }
  function actionFor(row, capital, chain) {
    var c = (row.category || '').toLowerCase();
    var name = row.name;
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0 || c.indexOf('uncollateralized') >= 0)
      return 'Supply $' + capital + ' of USDC to ' + name + ' on ' + chain + ' and keep the loan position open.';
    if (c.indexOf('dex') >= 0 || c.indexOf('liquidity manager') >= 0)
      return 'Provide $' + capital + ' of liquidity to ' + name + "'s main pool on " + chain + ' and keep the position open.';
    if (c.indexOf('yield aggregator') >= 0 || c.indexOf('leveraged farm') >= 0 || c.indexOf('yield') >= 0 || c.indexOf('farm') >= 0)
      return 'Deposit $' + capital + " of USDC into " + name + "'s highest-yield vault on " + chain + ' and leave it compounding.';
    if (c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0)
      return 'Deposit $' + capital + ' into a ' + name + ' curator vault on ' + chain + ' and hold the vault shares.';
    if (c.indexOf('rwa') >= 0)
      return 'Mint $' + capital + ' of the yield-bearing asset ' + name + ' offers on ' + chain + ' and hold it.';
    if (c.indexOf('derivative') >= 0 || c.indexOf('perpetual') >= 0 || c.indexOf('basis trading') >= 0)
      return 'Deposit $' + capital + ' of USDC as margin on ' + name + ' and open one small hedged position.';
    if (c.indexOf('prediction') >= 0)
      return 'Fund $' + capital + ' on ' + name + ' and place one position in an active prediction market.';
    if (c.indexOf('staking') >= 0 || c.indexOf('restak') >= 0)
      return 'Stake $' + capital + " of the chain's asset through " + name + ' on ' + chain + ' and keep the receipt token.';
    if (c.indexOf('stable') >= 0)
      return 'Mint or hold $' + capital + ' of the stable asset through ' + name + ' on ' + chain + '.';
    if (c.indexOf('insurance') >= 0)
      return 'Buy $' + capital + ' of cover from ' + name + ' on ' + chain + ' and keep the policy active.';
    if (c.indexOf('bridge') >= 0)
      return 'Bridge $' + capital + ' of USDC to ' + chain + ' through ' + name + ' and use the bridged funds in its app.';
    if (c.indexOf('chain') >= 0)
      return 'Bridge $' + capital + ' of USDC to ' + name + "'s chain and use one of its native apps.";
    if (c.indexOf('payment') >= 0 || c.indexOf('card') >= 0)
      return 'Spend $' + capital + ' through ' + name + ' on ' + chain + ' and keep the account active.';
    if (c.indexOf('index') >= 0)
      return 'Buy $' + capital + ' of the ' + name + ' index on ' + chain + ' and hold the position.';
    if (c.indexOf('governance') >= 0)
      return 'Lock $' + capital + ' of voting power through ' + name + ' on ' + chain + ' and vote on one proposal.';
    if (c.indexOf('otc') >= 0)
      return 'Complete one $' + capital + ' trade on ' + name + "'s desk and keep the account verified.";
    if (c.indexOf('btc') >= 0 || c.indexOf('anchor') >= 0)
      return 'Deposit $' + capital + ' of BTC-backed collateral through ' + name + ' on ' + chain + ' and hold the position.';
    return 'Deposit $' + capital + ' of USDC into ' + name + ' on ' + chain + ' and keep the position open.';
  }
  function farmSteps(row) {
    var chain = row.chains.length > 0 ? row.chains[0] : 'its main chain';
    var capital = capitalFor(row);
    var hold = holdFor(row.age_days);
    var action = actionFor(row, capital, chain);
    if (row.chains.length > 1) action += ' Also repeat the position on ' + row.chains[1] + ' if the protocol counts it.';
    var gas = capital >= 150 ? 8 : 4;
    return [
      { t: 'Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.', c: 'under $3 of gas for the first transaction', m: '5 minutes' },
      { t: action, c: '$' + capital + ' of capital and about $' + gas + ' of gas', m: '15 minutes to set up' },
      { t: 'Make one qualifying action each week on ' + chain + ', such as a deposit, a borrow, a swap or a vote, and vary the action.', c: 'about $2 of gas a week', m: '10 minutes a week' },
      { t: 'Hold the position for at least ' + hold + ' days so the activity is counted in more than one snapshot.', c: 'the $' + capital + ' stays in the position', m: hold + ' days' },
      { t: "Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes.", c: 'no fee to check, and never pay to claim', m: '10 minutes' },
      { t: 'Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.', c: 'nothing but the log', m: '5 minutes' },
    ];
  }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child === null || child === undefined) continue;
      if (Array.isArray(child)) child.forEach(function (c) { if (c) node.appendChild(c); });
      else if (typeof child === 'string') node.appendChild(document.createTextNode(child));
      else node.appendChild(child);
    }
    return node;
  }

  // The watchlist slugs are the snapshot's own: data.js carries them exactly.
  var watchSlugs = {};
  (DATA.watchlist_slugs || []).forEach(function (s) { watchSlugs[s] = true; });

  function filteredRows() {
    var q = state.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (state.watch && !watchSlugs[r.slug]) return false;
      if (state.category !== 'all' && (r.category || 'Uncategorised') !== state.category) return false;
      if (state.chain !== 'all' && r.chains.indexOf(state.chain) < 0) return false;
      if (state.sig !== 'all' && r.signal !== state.sig) return false;
      if (q && r.name.toLowerCase().indexOf(q) < 0 && r.slug.toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
  }
  function sortedRows(rows) {
    var key = state.sort, dir = state.dir;
    var val = function (r) {
      if (key === 'implied') return r.implied_value_usd;
      if (key === 'tvl') return r.tvl_usd;
      if (key === 'growth') return r.change_7d === null ? -9999 : r.change_7d;
      if (key === 'age') return r.age_days === null ? -1 : r.age_days;
      if (key === 'name') return r.name.toLowerCase();
      return r.rank;
    };
    return rows.slice().sort(function (a, b) {
      var va = val(a), vb = val(b);
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return (a.rank - b.rank);
    });
  }

  var maxImplied = Math.max.apply(null, DATA.rows.map(function (r) { return r.implied_value_usd; }));

  function renderStats() {
    var total = DATA.rows.reduce(function (n, r) { return n + r.implied_value_usd; }, 0);
    var topCat = {};
    DATA.rows.forEach(function (r) { topCat[r.category || 'Other'] = (topCat[r.category || 'Other'] || 0) + 1; });
    var top = Object.keys(topCat).sort(function (a, b) { return topCat[b] - topCat[a]; })[0];
    var stats = document.getElementById('stats');
    stats.innerHTML = '';
    [
      [DATA.watchlist_size + ' watchlist', 'protocols ≥ $50M, no token'],
      [DATA.board_size + ' ranked', DATA.early_size + ' early finds beyond the watchlist'],
      [fmtUsd(total), 'total implied value on the board'],
      [top || '—', 'largest category: ' + (top || '—') + ' (' + (topCat[top] || 0) + ' rows)'],
    ].forEach(function (s) {
      stats.appendChild(el('div', { 'class': 'stat' }, el('b', { text: s[0] }), el('span', { text: s[1] })));
    });
    document.getElementById('meta').textContent =
      'Snapshot: ' + DATA.as_of + ' · ' + DATA.source + ' · Model ' + DATA.model_version +
      ' · Implied value = TVL × ' + MODEL.base_multiple + ' × growth × maturity × breadth';
  }

  function renderBoard() {
    app.innerHTML = '';
    app.setAttribute('aria-busy', 'false');
    var rows = sortedRows(filteredRows());
    document.getElementById('count').textContent = rows.length + ' of ' + DATA.rows.length + ' rows';
    if (rows.length === 0) {
      app.appendChild(el('p', { 'class': 'empty', text: 'No protocol matches this filter. Loosen it to see the board again.' }));
      return;
    }
    var table = el('table');
    var head = el('tr');
    [['rank', 'Rank'], ['name', 'Protocol'], ['tvl', 'TVL'], ['growth', '7d'], ['age', 'Age'], ['sig', 'Signal'], ['implied', 'Implied value']].forEach(function (c) {
      var th = el('th', { text: c[1] + (state.sort === c[0] ? (state.dir === -1 ? ' ↓' : ' ↑') : '') });
      if (c[0] === 'implied' || c[0] === 'tvl' || c[0] === 'growth' || c[0] === 'age') th.className = 'num';
      th.addEventListener('click', function () {
        if (state.sort === c[0]) state.dir = -state.dir;
        else { state.sort = c[0]; state.dir = c[0] === 'name' ? 1 : -1; }
        renderBoard();
      });
      head.appendChild(th);
    });
    table.appendChild(head);
    rows.forEach(function (r) {
      var tr = el('tr', { 'class': 'row' });
      tr.addEventListener('click', function () { openDetail(r.slug); });
      var pctCls = r.change_7d === null ? 'flat' : r.change_7d > 0 ? 'up' : r.change_7d < 0 ? 'down' : 'flat';
      var barPct = Math.max(2, Math.round((r.implied_value_usd / maxImplied) * 100));
      tr.appendChild(el('td', { 'class': 'rank', text: '#' + r.rank }));
      tr.appendChild(el('td', {}, el('span', { 'class': 'name', text: r.name + (watchSlugs[r.slug] ? ' ★' : '') }),
        el('small', { text: (r.category || 'Uncategorised') + ' · ' + r.chains.slice(0, 3).join(', ') + (r.chains.length > 3 ? ' +' + (r.chains.length - 3) : '') })));
      tr.appendChild(el('td', { 'class': 'num', text: fmtUsd(r.tvl_usd) }));
      tr.appendChild(el('td', { 'class': 'num ' + pctCls, text: fmtPct(r.change_7d) }));
      tr.appendChild(el('td', { 'class': 'num', text: fmtAge(r.age_days) }));
      tr.appendChild(el('td', {}, el('span', { 'class': 'sig ' + r.signal, text: r.signal })));
      var imp = el('td', { 'class': 'num' }, el('span', { text: fmtUsd(r.implied_value_usd) }),
        el('span', { 'class': 'bar', html: '<i style="width:' + barPct + '%"></i>' }));
      tr.appendChild(imp);
      table.appendChild(tr);
    });
    app.appendChild(table);
  }

  function renderLive() {
    app.innerHTML = '';
    app.setAttribute('aria-busy', 'false');
    document.getElementById('count').textContent = DATA.live.length + ' live tokens by market cap';
    var table = el('table');
    var head = el('tr');
    ['Protocol', 'TVL', 'Market cap', 'MCAP / TVL', '7d'].forEach(function (h, i) {
      var th = el('th', { text: h });
      if (i > 0) th.className = 'num';
      head.appendChild(th);
    });
    table.appendChild(head);
    DATA.live.forEach(function (r) {
      var tr = el('tr');
      var pctCls = r.change_7d === null ? 'flat' : r.change_7d > 0 ? 'up' : r.change_7d < 0 ? 'down' : 'flat';
      var ratio = r.mcap_usd !== null && r.tvl_usd > 0 ? (r.mcap_usd / r.tvl_usd).toFixed(2) + '×' : 'n/a';
      tr.appendChild(el('td', {}, el('span', { 'class': 'name', text: r.name }),
        el('small', { text: (r.category || 'Uncategorised') + ' · ' + r.chains.slice(0, 3).join(', ') })));
      tr.appendChild(el('td', { 'class': 'num', text: fmtUsd(r.tvl_usd) }));
      tr.appendChild(el('td', { 'class': 'num', text: fmtUsd(r.mcap_usd) }));
      tr.appendChild(el('td', { 'class': 'num', text: ratio }));
      tr.appendChild(el('td', { 'class': 'num ' + pctCls, text: fmtPct(r.change_7d) }));
      table.appendChild(tr);
    });
    app.appendChild(table);
    app.appendChild(el('p', { 'class': 'note', text: 'These tokens already trade, so the board shows the market’s own value — never a model’s. A live token can still be farmed for points, but it is not a launch.' }));
  }

  function renderSandbox() {
    app.innerHTML = '';
    app.setAttribute('aria-busy', 'false');
    document.getElementById('count').textContent = 'change a constant, the board re-ranks live';
    var box = el('div', { 'class': 'sandbox' });
    box.appendChild(el('h2', { text: 'Model sandbox — radar-2, live' }));
    box.appendChild(el('p', { 'class': 'note', text: 'The sandbox re-scores every row from the snapshot figures with your constants. board.json keeps the radar-2 defaults; this is how you check the model, not how the entry is scored.' }));
    var sliders = [
      ['base_multiple', 'Base multiple (TVL ×)', 0.1, 0.5, 0.01],
      ['growth_weight', 'Growth weight', 0, 1, 0.05],
      ['breadth_weight', 'Breadth weight (per ln chain)', 0, 0.1, 0.01],
    ];
    var outs = {};
    sliders.forEach(function (s) {
      var lab = el('label', {}, el('span', { text: s[1] }), el('input', { type: 'range', min: s[2], max: s[3], step: s[4], value: String(MODEL[s[0]]) }), el('output', { text: String(MODEL[s[0]]) }));
      var input = lab.querySelector('input'), out = lab.querySelector('output');
      input.addEventListener('input', function () { out.textContent = input.value; rerank(); });
      outs[s[0]] = { input: input, out: out };
      box.appendChild(lab);
    });
    var res = el('div', { id: 'sandbox-result' });
    box.appendChild(res);
    app.appendChild(box);
    function rerank() {
      var m = {
        base_multiple: parseFloat(outs.base_multiple.input.value),
        growth_weight: parseFloat(outs.growth_weight.input.value),
        growth_floor: MODEL.growth_floor, growth_cap: MODEL.growth_cap,
        maturity_floor: MODEL.maturity_floor, maturity_range: MODEL.maturity_range,
        maturity_days: MODEL.maturity_days, unknown_age_days: MODEL.unknown_age_days,
        breadth_weight: parseFloat(outs.breadth_weight.input.value),
      };
      var scored = DATA.rows.map(function (r) {
        var v = impliedOf(r, m);
        return { row: r, implied: v.implied };
      }).sort(function (a, b) { return b.implied - a.implied || (a.row.rank - b.row.rank); });
      var changed = 0;
      scored.forEach(function (s, i) { if (s.row.rank !== i + 1) changed++; });
      var top = scored.slice(0, 10).map(function (s, i) {
        return el('tr', {},
          el('td', { 'class': 'rank', text: '#' + (i + 1) }),
          el('td', {}, el('span', { 'class': 'name', text: s.row.name })),
          el('td', { 'class': 'num', text: fmtUsd(s.implied) }),
          el('td', { 'class': 'num', text: 'was #' + s.row.rank }));
      });
      var table = el('table');
      var head = el('tr');
      ['Rank', 'Protocol', 'Implied value', 'Default rank'].forEach(function (h, i) {
        var th = el('th', { text: h });
        if (i > 1) th.className = 'num';
        head.appendChild(th);
      });
      table.appendChild(head);
      top.forEach(function (tr) { table.appendChild(tr); });
      res.innerHTML = '';
      res.appendChild(el('p', { 'class': 'note', text: changed + ' of ' + DATA.rows.length + ' rows move from their default rank under these constants. Top 10 now:' }));
      res.appendChild(table);
    }
    rerank();
  }

  function openDetail(slug) {
    var row = null;
    DATA.rows.forEach(function (r) { if (r.slug === slug) row = r; });
    if (!row) return;
    state.selected = slug;
    var v = impliedOf(row, MODEL);
    var matches = v.implied === row.implied_value_usd;
    var panel = document.getElementById('detail');
    panel.innerHTML = '';
    panel.hidden = false;
    panel.appendChild(el('button', { 'class': 'close', text: 'Close ✕', onclick: function () { panel.hidden = true; state.selected = null; } }));
    panel.appendChild(el('h2', { text: '#' + row.rank + ' ' + row.name }));
    panel.appendChild(el('p', { 'class': 'sub2', text: (row.category || 'Uncategorised') + ' · ' + row.chains.join(', ') + (watchSlugs[row.slug] ? ' · ★ Watchlist' : '') }));
    var dl = el('dl', { 'class': 'kv' });
    [['Implied value', fmtUsd(row.implied_value_usd)], ['TVL', fmtUsd(row.tvl_usd)], ['7-day TVL change', fmtPct(row.change_7d)],
     ['Age', fmtAge(row.age_days) + ' (' + row.age_band + ')'], ['Signal', row.signal],
     ['Listed', row.listed_at || 'unknown'], ['Token', 'records no token']].forEach(function (kv) {
      dl.appendChild(el('dt', { text: kv[0] }));
      dl.appendChild(el('dd', { text: kv[1] }));
    });
    panel.appendChild(dl);
    panel.appendChild(el('h3', { text: 'Why this value — the model, step by step' }));
    var m = el('dl', { 'class': 'kv' });
    [['Base: TVL × ' + MODEL.base_multiple, fmtUsd(row.tvl_usd * MODEL.base_multiple)],
     ['Growth ×' + v.growthMult.toFixed(4) + ' (7d ' + fmtPct(v.growth) + ')', '×' + v.growthMult.toFixed(4)],
     ['Maturity ×' + v.maturity.toFixed(4) + ' (' + fmtAge(v.age) + ')', '×' + v.maturity.toFixed(4)],
     ['Breadth ×' + v.breadth.toFixed(4) + ' (' + row.chains.length + ' chain' + (row.chains.length === 1 ? '' : 's') + ')', '×' + v.breadth.toFixed(4)],
     ['Implied value', fmtUsd(v.implied)]].forEach(function (kv) {
      m.appendChild(el('dt', { text: kv[0] }));
      m.appendChild(el('dd', { text: kv[1] }));
    });
    panel.appendChild(m);
    panel.appendChild(el('p', { 'class': 'note', text: matches ? '✓ The page recomputes this row from the snapshot figures and matches board.json exactly.' : 'The page recomputes this row as ' + fmtUsd(v.implied) + '; board.json carries ' + fmtUsd(row.implied_value_usd) + '.' }));
    panel.appendChild(el('h3', { text: 'Farm plan — six steps' }));
    var ol = el('ol', { 'class': 'steps' });
    farmSteps(row).forEach(function (s, i) {
      ol.appendChild(el('li', {}, el('b', { text: 'Step ' + (i + 1) + '. ' }), document.createTextNode(s.t), el('span', { 'class': 'ct', text: 'Cost: ' + s.c + ' · Time: ' + s.m })));
    });
    panel.appendChild(ol);
    var why = 'Rank #' + row.rank + ' because ' + fmtUsd(row.tvl_usd) + ' of TVL, a ' + fmtPct(row.change_7d) + ' seven-day move and ' + fmtAge(row.age_days) +
      ' with no token give an implied value of ' + fmtUsd(row.implied_value_usd) + ' — ' + row.signal.toLowerCase() + ' momentum on a ' + row.age_band.toLowerCase() + ' protocol.';
    panel.appendChild(el('h3', { text: 'Why it ranks here' }));
    panel.appendChild(el('p', { 'class': 'why', text: why }));
  }

  function setTab(tab) {
    state.tab = tab;
    document.getElementById('tab-board').classList.toggle('on', tab === 'board');
    document.getElementById('tab-live').classList.toggle('on', tab === 'live');
    document.getElementById('tab-model').classList.toggle('on', tab === 'model');
    document.getElementById('controls').style.display = tab === 'board' ? '' : 'none';
    if (tab === 'board') renderBoard();
    else if (tab === 'live') renderLive();
    else renderSandbox();
  }
  document.getElementById('tab-board').addEventListener('click', function () { setTab('board'); });
  document.getElementById('tab-live').addEventListener('click', function () { setTab('live'); });
  document.getElementById('tab-model').addEventListener('click', function () { setTab('model'); });

  // Populate the category and chain selects from the data itself.
  var cats = {}, chains = {};
  DATA.rows.forEach(function (r) {
    cats[r.category || 'Uncategorised'] = true;
    r.chains.forEach(function (c) { chains[c] = true; });
  });
  var catSel = document.getElementById('cat');
  Object.keys(cats).sort().forEach(function (c) { catSel.appendChild(el('option', { value: c, text: c + ' (' + DATA.rows.filter(function (r) { return (r.category || 'Uncategorised') === c; }).length + ')' })); });
  var chainSel = document.getElementById('chain');
  Object.keys(chains).sort().forEach(function (c) { chainSel.appendChild(el('option', { value: c, text: c })); });

  document.getElementById('q').addEventListener('input', function (e) { state.q = e.target.value; renderBoard(); });
  catSel.addEventListener('change', function (e) { state.category = e.target.value; renderBoard(); });
  chainSel.addEventListener('change', function (e) { state.chain = e.target.value; renderBoard(); });
  document.getElementById('sig').addEventListener('change', function (e) { state.sig = e.target.value; renderBoard(); });
  document.getElementById('watch').addEventListener('change', function (e) { state.watch = e.target.checked; renderBoard(); });

  // Staging for screenshots: ?shot=board | ?shot=detail&slug=<slug> | ?shot=filtered&category=<c>
  var params = new URLSearchParams(window.location.search);
  var shot = params.get('shot');
  renderStats();
  if (shot === 'filtered') {
    var cat = params.get('category');
    if (cat) { state.category = cat; catSel.value = cat; }
    var sig = params.get('signal');
    if (sig) { state.sig = sig; document.getElementById('sig').value = sig; }
    if (params.get('watch') === '1') { state.watch = true; document.getElementById('watch').checked = true; }
  }
  renderBoard();
  if (shot === 'detail') {
    var slug = params.get('slug') || (DATA.rows[0] && DATA.rows[0].slug);
    if (slug) openDetail(slug);
  }
})();
