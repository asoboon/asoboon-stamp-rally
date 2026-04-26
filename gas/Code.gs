// Code.gs — ASOBooN スタンプラリー API
// 依存: Config.gs

/* ═══════════════════════════════════════════════════════
   HTTP エントリポイント
═══════════════════════════════════════════════════════ */

function doGet(e) {
  var action = e && e.parameter && e.parameter.action;
  if (action === 'health') {
    return _json({
      ok:        true,
      status:    'healthy',
      visitDate: _getVisitDate(),
      timestamp: new Date().toISOString(),
    });
  }
  return _json({
    ok:      true,
    message: 'ASOBooN Stamp Rally API',
    usage:   'POST { action:"stamp"|"getStamps", spotId, idToken, lineUserId }',
  });
}

function doPost(e) {
  Logger.log('[doPost] called');
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return _json({ ok: false, success: false, error: 'No request body' });
    }

    var data = JSON.parse(e.postData.contents);
    var action    = data.action    || '';
    var spotId    = data.spotId    || '';
    var hasIdToken    = !!data.idToken;
    var hasLineUserId = !!data.lineUserId;

    Logger.log('[doPost] action=' + action
      + ' spotId=' + spotId
      + ' hasIdToken=' + hasIdToken
      + ' hasLineUserId=' + hasLineUserId);

    if (action === 'stamp') {
      return _json(_handleStamp(data));
    }
    if (action === 'getStamps') {
      return _json(_handleGetStamps(data));
    }

    return _json({ ok: false, success: false, error: 'Unknown action: ' + action });

  } catch (err) {
    Logger.log('[doPost] error: ' + err.message + '\n' + (err.stack || ''));
    return _json({ ok: false, success: false, error: err.message });
  }
}

function _json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ═══════════════════════════════════════════════════════
   アクションハンドラ
═══════════════════════════════════════════════════════ */

function _handleStamp(data) {
  var spotId = data.spotId || '';
  var validIds = DEFAULT_SPOTS.map(function(s) { return s.spotId; });
  if (!spotId || validIds.indexOf(spotId) === -1) {
    return { ok: false, success: false, error: ERROR_MESSAGES.INVALID_SPOT + ': ' + spotId };
  }

  var identity  = _resolveIdentity(data);
  var visitDate = _getVisitDate();
  var userKey   = _buildUserKey(identity.type, identity.value, visitDate);
  var ss        = _openSpreadsheet();
  var result    = _stampCore(userKey, spotId, visitDate, ss);

  Logger.log('[doPost] handleStampCore ok stampedCount=' + result.stampedCount);
  return result;
}

function _handleGetStamps(data) {
  var identity  = _resolveIdentity(data);
  var visitDate = _getVisitDate();
  var userKey   = _buildUserKey(identity.type, identity.value, visitDate);
  var ss        = _openSpreadsheet();

  var stamps     = _getUserStamps(userKey, visitDate, ss.getSheetByName(SHEET_CONFIG.stamps));
  var stampedIds = stamps.map(function(s) { return s.spotId; });
  var count      = stamps.length;
  var completed  = count >= APP_CONFIG.TOTAL_SPOTS;

  return {
    ok:             true,
    success:        true,
    visitDate:      visitDate,
    stampList:      _buildStampList(stampedIds),
    stampedCount:   count,
    totalSpots:     APP_CONFIG.TOTAL_SPOTS,
    remainingCount: APP_CONFIG.TOTAL_SPOTS - count,
    completed:      completed,
    isComplete:     completed,
  };
}

function _stampCore(userKey, spotId, visitDate, ss) {
  var stampsSheet = ss.getSheetByName(SHEET_CONFIG.stamps);
  var existing    = _getUserStamps(userKey, visitDate, stampsSheet);
  var already     = existing.some(function(s) { return s.spotId === spotId; });

  if (!already) {
    var nowISO = new Date().toISOString();
    stampsSheet.appendRow([userKey, spotId, nowISO, visitDate]);
    existing.push({ spotId: spotId, stampedAt: nowISO });
  }

  var stampedIds = existing.map(function(s) { return s.spotId; });
  var count      = existing.length;
  var completed  = count >= APP_CONFIG.TOTAL_SPOTS;

  if (completed) _recordCompletion(userKey, visitDate, ss);

  var currentSpot = DEFAULT_SPOTS.filter(function(s) { return s.spotId === spotId; })[0] || null;

  return {
    ok:             true,
    success:        true,
    visitDate:      visitDate,
    stampStatus:    already ? 'duplicate' : 'new',
    alreadyStamped: already,
    currentSpot:    currentSpot,
    stampList:      _buildStampList(stampedIds),
    stampedCount:   count,
    totalSpots:     APP_CONFIG.TOTAL_SPOTS,
    remainingCount: APP_CONFIG.TOTAL_SPOTS - count,
    completed:      completed,
    isComplete:     completed,
  };
}

/* ═══════════════════════════════════════════════════════
   ユーザー識別
═══════════════════════════════════════════════════════ */

function _resolveIdentity(data) {
  var props = PropertiesService.getScriptProperties();

  // 第一候補: idToken → LINE API 検証
  if (data.idToken) {
    try {
      var userId = _verifyLineIdToken(data.idToken, props);
      Logger.log('[doPost] verifyLineIdToken ok');
      return { type: 'idtoken', value: userId };
    } catch (e) {
      Logger.log('[doPost] verifyLineIdToken failed: ' + e.message);
    }
  }

  // 第二候補: lineUserId (形式チェックのみ)
  if (data.lineUserId && /^U[a-zA-Z0-9]{20,}$/.test(data.lineUserId)) {
    Logger.log('[doPost] fallback lineUserId accepted');
    return { type: 'userid', value: data.lineUserId };
  }

  throw new Error(ERROR_MESSAGES.IDENTITY_MISSING);
}

function _verifyLineIdToken(idToken, props) {
  var channelId = props.getProperty(PROPERTY_KEYS.LINE_CHANNEL_ID);
  if (!channelId) {
    var liffId = props.getProperty(PROPERTY_KEYS.LIFF_ID) || APP_CONFIG.LIFF_ID;
    channelId  = liffId.split('-')[0];
  }

  var res = UrlFetchApp.fetch('https://api.line.me/oauth2/v2.1/verify', {
    method:             'post',
    payload:            { id_token: idToken, client_id: channelId },
    muteHttpExceptions: true,
  });

  var body = JSON.parse(res.getContentText());
  if (body.error) {
    throw new Error(ERROR_MESSAGES.VERIFY_FAILED + ': ' + (body.error_description || body.error));
  }
  return body.sub;
}

/* ═══════════════════════════════════════════════════════
   userKey 生成
   SHA-256(identityType + identityValue + visitDate + SECRET_KEY)
═══════════════════════════════════════════════════════ */

function _buildUserKey(identityType, identityValue, visitDate) {
  var props  = PropertiesService.getScriptProperties();
  var secret = props.getProperty(PROPERTY_KEYS.SECRET_KEY);
  if (!secret) throw new Error(ERROR_MESSAGES.NO_SECRET_KEY);

  return _sha256(identityType + identityValue + visitDate + secret);
}

function _sha256(input) {
  var bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    input,
    Utilities.Charset.UTF_8
  );
  return bytes.map(function(b) {
    return ('0' + (b & 0xFF).toString(16)).slice(-2);
  }).join('');
}

/* ═══════════════════════════════════════════════════════
   スプレッドシート操作
═══════════════════════════════════════════════════════ */

function _openSpreadsheet() {
  var id = PropertiesService.getScriptProperties().getProperty(PROPERTY_KEYS.SPREADSHEET_ID);
  if (!id) throw new Error(ERROR_MESSAGES.NO_SPREADSHEET_ID);
  return SpreadsheetApp.openById(id);
}

function _getUserStamps(userKey, visitDate, stampsSheet) {
  var rows   = stampsSheet.getDataRange().getValues();
  var seen   = {};
  var result = [];
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    // r[0]=userKey, r[1]=spotId, r[2]=stampedAt, r[3]=visitDate
    if (r[0] === userKey && r[3] === visitDate && !seen[r[1]]) {
      seen[r[1]] = true;
      result.push({ spotId: r[1], stampedAt: r[2] });
    }
  }
  return result;
}

function _buildStampList(stampedIds) {
  return DEFAULT_SPOTS.map(function(spot) {
    return {
      spotId:      spot.spotId,
      spotName:    spot.spotName,
      description: spot.description,
      order:       spot.order,
      stamped:     stampedIds.indexOf(spot.spotId) !== -1,
    };
  });
}

function _recordCompletion(userKey, visitDate, ss) {
  var claimsSheet = ss.getSheetByName(SHEET_CONFIG.claims);
  var rows        = claimsSheet.getDataRange().getValues();
  var todayISO    = visitDate.replace(/\//g, '-'); // yyyy-MM-dd

  var exists = rows.slice(1).some(function(r) {
    return r[0] === userKey && String(r[1]).indexOf(todayISO) === 0;
  });
  if (!exists) {
    claimsSheet.appendRow([userKey, new Date().toISOString(), null, 'completed']);
  }
}

/* ═══════════════════════════════════════════════════════
   visitDate (Asia/Tokyo, 4時リセット)
═══════════════════════════════════════════════════════ */

function _getVisitDate() {
  var now     = new Date();
  var jstHour = parseInt(Utilities.formatDate(now, APP_CONFIG.TIMEZONE, 'HH'), 10);
  if (jstHour < APP_CONFIG.RESET_HOUR) {
    now = new Date(now.getTime() - 86400000);
  }
  return Utilities.formatDate(now, APP_CONFIG.TIMEZONE, APP_CONFIG.DATE_FORMAT);
}

/* ═══════════════════════════════════════════════════════
   毎日リセット
═══════════════════════════════════════════════════════ */

function deleteOldStampData() {
  var today = _getVisitDate();
  var ss    = _openSpreadsheet();

  _deleteRowsNotMatchingDate(ss.getSheetByName(SHEET_CONFIG.stamps), 4, today);
  _deleteOldClaims(ss.getSheetByName(SHEET_CONFIG.claims), today);

  Logger.log('[deleteOldStampData] done visitDate=' + today);
}

function _deleteRowsNotMatchingDate(sheet, colIndex, today) {
  var rows = sheet.getDataRange().getValues();
  for (var i = rows.length - 1; i >= 1; i--) {
    if (rows[i][colIndex - 1] !== today) sheet.deleteRow(i + 1);
  }
}

function _deleteOldClaims(claimsSheet, today) {
  var todayISO = today.replace(/\//g, '-');
  var rows     = claimsSheet.getDataRange().getValues();
  for (var i = rows.length - 1; i >= 1; i--) {
    if (String(rows[i][1]).indexOf(todayISO) !== 0) claimsSheet.deleteRow(i + 1);
  }
}

function installDailyResetTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'deleteOldStampData') ScriptApp.deleteTrigger(t);
  });

  ScriptApp.newTrigger('deleteOldStampData')
    .timeBased()
    .everyDays(1)
    .atHour(APP_CONFIG.RESET_HOUR)
    .inTimezone(APP_CONFIG.TIMEZONE)
    .create();

  Logger.log('[installDailyResetTrigger] installed hour='
    + APP_CONFIG.RESET_HOUR + ' tz=' + APP_CONFIG.TIMEZONE);
}

/* ═══════════════════════════════════════════════════════
   初回セットアップ（手動実行）
═══════════════════════════════════════════════════════ */

function setupPrototype() {
  var ss = _openSpreadsheet();

  Object.keys(SHEET_CONFIG).forEach(function(key) {
    var name    = SHEET_CONFIG[key];
    var headers = SHEET_HEADERS[key];
    var sheet   = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
      sheet.appendRow(headers);
      Logger.log('[setupPrototype] created sheet: ' + name);
    } else if (sheet.getLastRow() === 0) {
      sheet.appendRow(headers);
    }
  });

  // spots シートにデフォルトデータを挿入
  var spotsSheet = ss.getSheetByName(SHEET_CONFIG.spots);
  if (spotsSheet.getLastRow() <= 1) {
    DEFAULT_SPOTS.forEach(function(s) {
      spotsSheet.appendRow([s.spotId, s.spotName, s.description, s.order, s.active]);
    });
  }

  // settings シートに初期値を挿入
  var settingsSheet = ss.getSheetByName(SHEET_CONFIG.settings);
  if (settingsSheet.getLastRow() <= 1) {
    settingsSheet.appendRow(['totalSpots', APP_CONFIG.TOTAL_SPOTS, 'コンプリートに必要なスタンプ数']);
    settingsSheet.appendRow(['eventName',  'ASOBooN スタンプラリー', 'イベント名']);
    settingsSheet.appendRow(['resetHour',  APP_CONFIG.RESET_HOUR,  '毎日リセット時刻 (JST)']);
  }

  installDailyResetTrigger();

  Logger.log('[setupPrototype] done');
}
