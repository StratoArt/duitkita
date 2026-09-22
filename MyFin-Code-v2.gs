/*******************************************************
 * MyFin — Google Apps Script API
 * Version: V1
 *
 * Spreadsheet tabs required:
 * README
 * Dashboard
 * Transactions
 * Accounts
 * Categories
 * Income Sources
 * Savings Goals
 * Budgets
 * Settings
 *
 * Deploy:
 * 1. Extensions > Apps Script
 * 2. Paste this file into Code.gs
 * 3. Save
 * 4. Deploy > New deployment
 * 5. Type: Web app
 * 6. Execute as: Me
 * 7. Who has access: Anyone
 *******************************************************/

const TX_HEADERS = ['ID','Tanggal','Tipe','Kategori','Nominal','Akun','Sumber Pemasukan','Catatan','Created At','Akun Tujuan'];

const CONFIG = {
  SPREADSHEET_ID: '', // Leave blank if script is bound to the Google Sheet.
  SHEETS: {
    transactions: 'Transactions',
    accounts: 'Accounts',
    categories: 'Categories',
    incomeSources: 'Income Sources',
    goals: 'Savings Goals',
    budgets: 'Budgets',
    settings: 'Settings'
  }
};

function getSpreadsheet_() {
  if (CONFIG.SPREADSHEET_ID && CONFIG.SPREADSHEET_ID.trim()) {
    return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID.trim());
  }
  return SpreadsheetApp.getActiveSpreadsheet();
}

function json_(data, status) {
  const output = {
    success: status !== false,
    data: data
  };
  return ContentService
    .createTextOutput(JSON.stringify(output))
    .setMimeType(ContentService.MimeType.JSON);
}

function error_(message) {
  return json_({ message: message }, false);
}

function doGet(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) || 'bootstrap';

    switch (action) {
      case 'bootstrap':
        return json_(getBootstrap_());
      case 'dashboard':
        return json_(getDashboard_());
      case 'transactions':
        return json_(getTransactions_(e.parameter));
      case 'accounts':
        return json_(getAccounts_());
      case 'categories':
        return json_(getCategories_());
      case 'incomeSources':
        return json_(getIncomeSources_());
      case 'goals':
        return json_(getGoals_());
      case 'budgets':
        return json_(getBudgets_());
      case 'health':
        return json_({ app: 'MyFin', status: 'online', timestamp: new Date() });
      default:
        return error_('Action GET tidak dikenal: ' + action);
    }
  } catch (err) {
    console.error(err);
    return error_(err.message || String(err));
  }
}

function doPost(e) {
  try {
    const body = parseBody_(e);
    const action = body.action || '';

    switch (action) {
      case 'saveTransaction':
        return json_(saveTransaction_(body));
      case 'updateTransaction':
        return json_(updateTransaction_(body));
      case 'deleteTransaction':
        return json_(deleteTransaction_(body));
      case 'saveAccount':
        return json_(saveAccount_(body));
      case 'saveGoal':
        return json_(saveGoal_(body));
      case 'saveBudget':
        return json_(saveBudget_(body));
      default:
        return error_('Action POST tidak dikenal: ' + action);
    }
  } catch (err) {
    console.error(err);
    return error_(err.message || String(err));
  }
}

function parseBody_(e) {
  if (!e || !e.postData || !e.postData.contents) {
    return {};
  }

  const raw = e.postData.contents;

  try {
    return JSON.parse(raw);
  } catch (_) {
    // Fallback untuk x-www-form-urlencoded.
    const result = {};
    const params = e.parameter || {};
    Object.keys(params).forEach(function(key) {
      result[key] = params[key];
    });
    return result;
  }
}

/* =========================
 * BOOTSTRAP
 * ========================= */

function getBootstrap_() {
  return {
    app: getSettings_().APP_NAME || 'MyFin',
    settings: getSettings_(),
    dashboard: getDashboard_(),
    accounts: getAccounts_(),
    categories: getCategories_(),
    incomeSources: getIncomeSources_(),
    goals: getGoals_(),
    budgets: getBudgets_(),
    transactions: getTransactions_({ limit: 50 })
  };
}

/* =========================
 * DASHBOARD
 * ========================= */

function getDashboard_() {
  const tx = getTransactionObjects_();
  const now = new Date();

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  let income = 0;
  let expense = 0;
  let savings = 0;

  const byCategory = {};

  tx.forEach(function(t) {
    if (!t.dateObj) return;

    if (t.dateObj >= monthStart && t.dateObj <= monthEnd) {
      if (t.type === 'Pemasukan') income += t.amount;
      if (t.type === 'Pengeluaran') {
        expense += t.amount;
        byCategory[t.category || 'Lainnya'] =
          (byCategory[t.category || 'Lainnya'] || 0) + t.amount;
      }
    }

    if (t.type === 'Transfer' && t.toAccount === 'Tabungan') savings += t.amount;
  });

  const accounts = getAccounts_();
  const totalBalance = accounts.reduce(function(sum, a) {
    return sum + Number(a.balance || 0);
  }, 0);

  const categoryList = Object.keys(byCategory)
    .map(function(name) {
      return { category: name, amount: byCategory[name] };
    })
    .sort(function(a, b) {
      return b.amount - a.amount;
    });

  return {
    period: formatDate_(monthStart, 'yyyy-MM'),
    income: income,
    expense: expense,
    net: income - expense,
    savings: savings,
    totalBalance: totalBalance,
    byCategory: categoryList,
    transactionCount: tx.length
  };
}

/* =========================
 * TRANSACTIONS
 * ========================= */

function getTransactions_(params) {
  params = params || {};
  let tx = getTransactionObjects_();

  if (params.type) {
    tx = tx.filter(function(t) { return t.type === params.type; });
  }

  if (params.category) {
    tx = tx.filter(function(t) { return t.category === params.category; });
  }

  if (params.account) {
    tx = tx.filter(function(t) { return t.account === params.account; });
  }

  if (params.from) {
    const from = parseDate_(params.from);
    tx = tx.filter(function(t) { return t.dateObj && t.dateObj >= from; });
  }

  if (params.to) {
    const to = parseDate_(params.to);
    to.setHours(23, 59, 59, 999);
    tx = tx.filter(function(t) { return t.dateObj && t.dateObj <= to; });
  }

  tx.sort(function(a, b) {
    return (b.dateObj ? b.dateObj.getTime() : 0) -
           (a.dateObj ? a.dateObj.getTime() : 0);
  });

  const limit = Math.min(Math.max(Number(params.limit || 100), 1), 500);
  return tx.slice(0, limit).map(cleanTransaction_);
}

function getTransactionObjects_() {
  const sh = sheet_('transactions');
  const values = getDataRows_(sh);

  return values.map(function(row) {
    const dateObj = normalizeDate_(row[1]);

    return {
      row: row.__row,
      id: String(row[0] || ''),
      date: dateObj ? formatDate_(dateObj, 'yyyy-MM-dd') : '',
      dateObj: dateObj,
      type: String(row[2] || ''),
      category: String(row[3] || ''),
      amount: Number(row[4] || 0),
      account: String(row[5] || ''),
      source: String(row[6] || ''),
      note: String(row[7] || ''),
      createdAt: row[8] ? String(row[8]) : '',
      toAccount: String(row[9] || '')
    };
  });
}

function cleanTransaction_(t) {
  return {
    id: t.id,
    date: t.date,
    type: t.type,
    category: t.category,
    amount: t.amount,
    account: t.account,
    source: t.source,
    note: t.note,
    createdAt: t.createdAt,
    toAccount: t.toAccount
  };
}

function saveTransaction_(body) {
  validateTransaction_(body);

  const sh = sheet_('transactions');
  const id = body.id || nextId_('TRX-', sh, 1);
  const date = parseDate_(body.date || formatDate_(new Date(), 'yyyy-MM-dd'));

  ensureTransactionColumns_(sh);
  const row = [
    id, date, body.type, body.category || '', Number(body.amount || 0),
    body.account || '', body.source || '', body.note || '', new Date(), body.toAccount || ''
  ];

  sh.appendRow(row);

  return {
    message: 'Transaksi berhasil disimpan.',
    transaction: {
      id: id,
      date: formatDate_(date, 'yyyy-MM-dd'),
      type: body.type,
      category: body.category || '',
      amount: Number(body.amount || 0),
      account: body.account || '',
      source: body.source || '',
      note: body.note || '',
      toAccount: body.toAccount || ''
    }
  };
}

function updateTransaction_(body) {
  if (!body.id) throw new Error('ID transaksi wajib diisi.');

  const sh = sheet_('transactions');
  ensureTransactionColumns_(sh);
  const values = sh.getDataRange().getValues();

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]) === String(body.id)) {
      const rowNumber = i + 1;
      const date = parseDate_(body.date || formatDate_(new Date(), 'yyyy-MM-dd'));

      sh.getRange(rowNumber, 1, 1, 10).setValues([[
        body.id,
        date,
        body.type,
        body.category || '',
        Number(body.amount || 0),
        body.account || '',
        body.source || '',
        body.note || '',
        values[i][8] || new Date(),
        body.toAccount || ''
      ]]);

      return { message: 'Transaksi berhasil diperbarui.' };
    }
  }

  throw new Error('Transaksi tidak ditemukan.');
}

function deleteTransaction_(body) {
  if (!body.id) throw new Error('ID transaksi wajib diisi.');

  const sh = sheet_('transactions');
  const values = sh.getDataRange().getValues();

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]) === String(body.id)) {
      sh.deleteRow(i + 1);
      return { message: 'Transaksi berhasil dihapus.' };
    }
  }

  throw new Error('Transaksi tidak ditemukan.');
}

function validateTransaction_(body) {
  const allowed = ['Pemasukan', 'Pengeluaran', 'Transfer'];

  if (!body.type || allowed.indexOf(body.type) === -1) {
    throw new Error('Tipe transaksi tidak valid.');
  }

  if (Number(body.amount || 0) <= 0) {
    throw new Error('Nominal harus lebih besar dari 0.');
  }
  if (!body.account) throw new Error('Akun wajib diisi.');
  if (body.type === 'Transfer' && (!body.toAccount || body.toAccount === body.account)) {
    throw new Error('Akun tujuan transfer tidak valid.');
  }

  if (!body.date) {
    body.date = formatDate_(new Date(), 'yyyy-MM-dd');
  }
}

/* =========================
 * ACCOUNTS
 * ========================= */

function getAccounts_() {
  const sh = sheet_('accounts');
  const rows = getDataRows_(sh);
  const tx = getTransactionObjects_();
  const result = [];

  rows.forEach(function(row) {
    const id = String(row[0] || '');
    const name = String(row[1] || '');
    if (!id && !name) return;

    let balance = Number(row[3] || 0);
    tx.forEach(function(t) {
      if (t.type === 'Pemasukan' && t.account === name) balance += t.amount;
      if (t.type === 'Pengeluaran' && t.account === name) balance -= t.amount;
      if (t.type === 'Transfer') {
        if (t.account === name) balance -= t.amount;
        if (t.toAccount === name) balance += t.amount;
      }
    });

    result.push({id:id,name:name,type:String(row[2] || ''),initialBalance:Number(row[3] || 0),balance:balance,active:String(row[4] || 'Ya')});
  });
  return result;
}

function saveAccount_(body) {
  if (!body.name) throw new Error('Nama akun wajib diisi.');

  const sh = sheet_('accounts');
  const id = body.id || nextId_('ACC-', sh, 1);

  sh.appendRow([
    id,
    body.name,
    body.type || 'Lainnya',
    Number(body.initialBalance || 0),
    body.active || 'Ya'
  ]);

  return { message: 'Akun berhasil disimpan.', id: id };
}

/* =========================
 * CATEGORIES
 * ========================= */

function getCategories_() {
  const sh = sheet_('categories');
  return getDataRows_(sh).filter(function(row) {
    return row[0] || row[1];
  }).map(function(row) {
    return {
      id: String(row[0] || ''),
      name: String(row[1] || ''),
      type: String(row[2] || ''),
      icon: String(row[3] || '')
    };
  });
}

/* =========================
 * INCOME SOURCES
 * ========================= */

function getIncomeSources_() {
  const sh = sheet_('incomeSources');
  return getDataRows_(sh).filter(function(row) {
    return row[0] || row[1];
  }).map(function(row) {
    return {
      id: String(row[0] || ''),
      name: String(row[1] || ''),
      description: String(row[2] || '')
    };
  });
}

/* =========================
 * SAVINGS GOALS
 * ========================= */

function getGoals_() {
  const sh = sheet_('goals');
  return getDataRows_(sh).filter(function(row) {
    return row[0] || row[1];
  }).map(function(row) {
    const target = Number(row[2] || 0);
    const current = Number(row[3] || 0);

    return {
      id: String(row[0] || ''),
      name: String(row[1] || ''),
      target: target,
      current: current,
      deadline: row[4] ? formatDate_(normalizeDate_(row[4]), 'yyyy-MM-dd') : '',
      status: String(row[5] || 'Aktif'),
      percentage: target > 0 ? Math.min(100, (current / target) * 100) : 0
    };
  });
}

function saveGoal_(body) {
  if (!body.name) throw new Error('Nama target wajib diisi.');

  const sh = sheet_('goals');
  const id = body.id || nextId_('GOAL-', sh, 1);

  sh.appendRow([
    id,
    body.name,
    Number(body.target || 0),
    Number(body.current || 0),
    body.deadline ? parseDate_(body.deadline) : '',
    body.status || 'Aktif'
  ]);

  return { message: 'Target tabungan berhasil disimpan.', id: id };
}

/* =========================
 * BUDGETS
 * ========================= */

function getBudgets_() {
  const sh = sheet_('budgets');
  return getDataRows_(sh).filter(function(row) {
    return row[0] || row[1];
  }).map(function(row) {
    const budget = Number(row[2] || 0);
    const spent = Number(row[3] || 0);

    return {
      month: String(row[0] || ''),
      category: String(row[1] || ''),
      budget: budget,
      spent: spent,
      remaining: budget - spent,
      status: String(row[5] || '')
    };
  });
}

function saveBudget_(body) {
  if (!body.month || !body.category) {
    throw new Error('Bulan dan kategori wajib diisi.');
  }

  const sh = sheet_('budgets');
  sh.appendRow([
    body.month,
    body.category,
    Number(body.budget || 0),
    Number(body.spent || 0),
    '',
    ''
  ]);

  return { message: 'Budget berhasil disimpan.' };
}

/* =========================
 * SETTINGS
 * ========================= */

function getSettings_() {
  const sh = sheet_('settings');
  const rows = getDataRows_(sh);
  const result = {};

  rows.forEach(function(row) {
    if (row[0]) result[String(row[0])] = row[1];
  });

  return result;
}

/* =========================
 * HELPERS
 * ========================= */

function sheet_(key) {
  const name = CONFIG.SHEETS[key];
  const sh = getSpreadsheet_().getSheetByName(name);

  if (!sh) {
    throw new Error('Sheet "' + name + '" tidak ditemukan.');
  }

  return sh;
}

function getDataRows_(sh) {
  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();

  if (lastRow < 2 || lastCol < 1) return [];

  const values = sh.getRange(2, 1, lastRow - 1, lastCol).getValues();

  return values.map(function(row, index) {
    row.__row = index + 2;
    return row;
  });
}

function ensureTransactionColumns_(sh) {
  if (sh.getLastColumn() < 10) sh.getRange(1, 10).setValue('Akun Tujuan');
}

function normalizeDate_(value) {
  if (!value) return null;

  if (Object.prototype.toString.call(value) === '[object Date]') {
    return isNaN(value.getTime()) ? null : value;
  }

  return parseDate_(String(value));
}

function parseDate_(value) {
  if (!value) return new Date();

  if (Object.prototype.toString.call(value) === '[object Date]') {
    return new Date(value.getTime());
  }

  const s = String(value).trim();

  // yyyy-MM-dd
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const p = s.split('-');
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  }

  // dd/MM/yyyy
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    const p = s.split('/');
    return new Date(Number(p[2]), Number(p[1]) - 1, Number(p[0]));
  }

  const d = new Date(s);
  if (isNaN(d.getTime())) {
    throw new Error('Format tanggal tidak valid: ' + s);
  }

  return d;
}

function formatDate_(date, pattern) {
  if (!date) return '';

  return Utilities.formatDate(
    date,
    Session.getScriptTimeZone() || 'Asia/Jakarta',
    pattern || 'yyyy-MM-dd'
  );
}

function nextId_(prefix, sh, column) {
  const values = sh.getRange(2, column, Math.max(sh.getLastRow() - 1, 1), 1).getValues();

  let max = 0;

  values.forEach(function(row) {
    const value = String(row[0] || '');
    if (value.indexOf(prefix) === 0) {
      const n = parseInt(value.replace(prefix, ''), 10);
      if (!isNaN(n) && n > max) max = n;
    }
  });

  return prefix + String(max + 1).padStart(4, '0');
}

/**
 * Jalankan sekali setelah paste code.
 * Ini mengatur timezone spreadsheet ke Asia/Jakarta.
 */
function setupMyFin() {
  const ss = getSpreadsheet_();
  ss.setSpreadsheetTimeZone('Asia/Jakarta');
  ensureTransactionColumns_(sheet_('transactions'));

  const required = Object.keys(CONFIG.SHEETS).map(function(key) {
    return CONFIG.SHEETS[key];
  });

  const missing = required.filter(function(name) {
    return !ss.getSheetByName(name);
  });

  if (missing.length) {
    throw new Error('Sheet yang belum ada: ' + missing.join(', '));
  }

  Logger.log('MyFin siap digunakan.');
}

/**
 * Tes sederhana.
 */
function testMyFin() {
  Logger.log(JSON.stringify(getBootstrap_(), null, 2));
}
