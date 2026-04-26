// Code.gs — ASOBooN スタンプラリー API

// ─── HTTP エントリポイント ─────────────────────────────────────────────────

function doGet(e) {
  return jsonResponse({ status: 'ok', message: 'ASOBooN Stamp Rally API' });
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse({ success: false, error: 'No request body' });
    }
    var data   = JSON.parse(e.postData.contents);
    var action = data.action;

    if (action === 'stamp') {
      return jsonResponse(handleStamp(data));
    }
    if (action === 'getStamps') {
      return jsonResponse(handleGetStamps(data));
    }
    return jsonResponse({ success: false, error: 'Unknown action: ' + action });

  } catch (err) {
    Logger.log('doPost error: ' + err.message);
    return jsonResponse({ success: false, error: err.message });
  }
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ─── アクションハンドラ ───────────────────────────────────────────────────

function handleStamp(data) {
  var userKey = getUserKey(data);
  var spotId  = data.spotId;

  if (!spotId) return { success: false, error: 'spotId is required' };

  var validIds = DEFAULT_SPOTS.map(function(s) { return s.spotId; });
  if (validIds.indexOf(spotId) === -1) {
    return { success: false, error: 'Invalid spotId: ' + spotId };
  }

  var ss          = openSpreadsheet();
  var stampsSheet = ss.getSheetByName(SHEET_NAMES.stamps);
  var existing    = getAllUserStamps(userKey, stampsSheet);
  var already     = existing.some(function(s) { return s.spotId === spotId; });

  if (!already) {
    var now   = new Date();
    var today = Utilities.formatDate(now, 'Asia/Tokyo', 'yyyy-MM-dd');
    stampsSheet.appendRow([userKey, spotId, now.toISOString(), today]);
    existing.push({ spotId: spotId, stampedAt: now.toISOString() });
  }

  var completed = existing.length >= DEFAULT_SPOTS.length;
  if (completed) recordCompletion(userKey, ss);

  return {
    success:       true,
    stamps:        existing,
    completed:     completed,
    alreadyStamped: already,
    currentSpot:   spotId,
  };
}

function handleGetStamps(data) {
  var userKey     = getUserKey(data);
  var ss          = openSpreadsheet();
  var stampsSheet = ss.getSheetByName(SHEET_NAMES.stamps);
  var stamps      = getAllUserStamps(userKey, stampsSheet);
  var completed   = stamps.length >= DEFAULT_SPOTS.length;

  return {
    success:   true,
    stamps:    stamps,
    completed: completed,
  };
}

// ─── スプレッドシート操作 ─────────────────────────────────────────────────

function openSpreadsheet() {
  var id = PropertiesService.getScriptProperties().getProperty('ASOBOON_SPREADSHEET_ID');
  if (!id) throw new Error('ASOBOON_SPREADSHEET_ID が設定されていません。');
  return SpreadsheetApp.openById(id);
}

function getAllUserStamps(userKey, stampsSheet) {
  var rows  = stampsSheet.getDataRange().getValues();
  var seen  = {};
  var result = [];

  for (var i = 1; i < rows.length; i++) {
    var row = rows[i];
    var key = row[0];
    var sid = row[1];
    if (key === userKey && !seen[sid]) {
      seen[sid] = true;
      result.push({ spotId: sid, stampedAt: row[2] });
    }
  }
  return result;
}

function recordCompletion(userKey, ss) {
  var claimsSheet = ss.getSheetByName(SHEET_NAMES.claims);
  var rows = claimsSheet.getDataRange().getValues();
  var exists = rows.slice(1).some(function(r) { return r[0] === userKey; });
  if (!exists) {
    claimsSheet.appendRow([userKey, new Date().toISOString(), null, 'completed']);
  }
}

// ─── ユーザーキー生成 ─────────────────────────────────────────────────────

function getUserKey(data) {
  var props  = PropertiesService.getScriptProperties();
  var secret = props.getProperty('ASOBOON_SECRET_KEY');
  if (!secret) throw new Error('ASOBOON_SECRET_KEY が設定されていません。');

  var userId;
  if (data.idToken) {
    userId = verifyIdToken(data.idToken, props);
  } else if (data.userId) {
    userId = data.userId;
  } else {
    throw new Error('ユーザー識別情報がありません。');
  }

  if (!userId) throw new Error('ユーザーIDの取得に失敗しました。');
  return hashUserId(userId, secret);
}

function verifyIdToken(idToken, props) {
  var channelId = props.getProperty('LINE_CHANNEL_ID');
  if (!channelId) {
    var liffId = props.getProperty('ASOBOON_LIFF_ID') || LIFF_ID;
    channelId  = liffId.split('-')[0];
  }

  var res = UrlFetchApp.fetch('https://api.line.me/oauth2/v2.1/verify', {
    method:            'post',
    payload:           { id_token: idToken, client_id: channelId },
    muteHttpExceptions: true,
  });

  var body = JSON.parse(res.getContentText());
  if (body.error) {
    throw new Error('idToken 検証失敗: ' + (body.error_description || body.error));
  }
  return body.sub;
}

function hashUserId(userId, secret) {
  var bytes = Utilities.computeHmacSha256Signature(userId, secret);
  return bytes.map(function(b) {
    return ('0' + (b & 0xFF).toString(16)).slice(-2);
  }).join('');
}

// ─── セットアップ（初回のみ手動実行） ────────────────────────────────────

function setup() {
  var ss = openSpreadsheet();

  _ensureSheet(ss, SHEET_NAMES.spots,    ['spotId', 'spotName', 'description', 'order', 'active']);
  _ensureSheet(ss, SHEET_NAMES.stamps,   ['userKey', 'spotId', 'stampedAt', 'visitDate']);
  _ensureSheet(ss, SHEET_NAMES.claims,   ['userKey', 'completedAt', 'claimedAt', 'status']);
  _ensureSheet(ss, SHEET_NAMES.settings, ['key', 'value', 'note']);

  var spotsSheet = ss.getSheetByName(SHEET_NAMES.spots);
  if (spotsSheet.getLastRow() <= 1) {
    DEFAULT_SPOTS.forEach(function(spot) {
      spotsSheet.appendRow([spot.spotId, spot.spotName, spot.description, spot.order, spot.active]);
    });
  }

  var settingsSheet = ss.getSheetByName(SHEET_NAMES.settings);
  if (settingsSheet.getLastRow() <= 1) {
    settingsSheet.appendRow(['totalSpots', DEFAULT_SPOTS.length, '必要なスタンプ数']);
    settingsSheet.appendRow(['eventName',  'ASOBooN スタンプラリー', 'イベント名']);
  }

  Logger.log('setup() 完了');
}

function _ensureSheet(ss, name, headers) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    Logger.log('シート作成: ' + name);
  } else if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
  }
}
