// Config.gs — 定数・設定定義。Code.gs から参照する。

var APP_CONFIG = {
  LIFF_ID:     '2009888671-57TOefc3',
  TOTAL_SPOTS: 4,
  RESET_HOUR:  4,             // 毎日リセット時刻 (JST)
  TIMEZONE:    'Asia/Tokyo',
  DATE_FORMAT: 'yyyy/MM/dd',  // visitDate の書式
};

var SHEET_CONFIG = {
  spots:    'spots',
  stamps:   'stamps',
  claims:   'claims',
  settings: 'settings',
};

var SHEET_HEADERS = {
  spots:    ['spotId', 'spotName', 'description', 'order', 'active'],
  stamps:   ['userKey', 'spotId', 'stampedAt', 'visitDate'],
  claims:   ['userKey', 'completedAt', 'claimedAt', 'status'],
  settings: ['key', 'value', 'note'],
};

var DEFAULT_SPOTS = [
  {
    spotId:      'spot_01',
    spotName:    'みまもり',
    description: '保護者の方は必ずお子様の近くにいてください。',
    order:       1,
    active:      true,
  },
  {
    spotId:      'spot_02',
    spotName:    '飲食ルール',
    description: '食べ物は食べられません。飲み物は土足の場所でお願いします。',
    order:       2,
    active:      true,
  },
  {
    spotId:      'spot_03',
    spotName:    '順番',
    description: '順番や回数を守って遊びましょう。',
    order:       3,
    active:      true,
  },
  {
    spotId:      'spot_04',
    spotName:    '入退場',
    description: '退場の際はロッカーを空っぽにしてください。',
    order:       4,
    active:      true,
  },
];

var ERROR_MESSAGES = {
  NO_SPREADSHEET_ID: 'ASOBOON_SPREADSHEET_ID が設定されていません。',
  NO_SECRET_KEY:     'ASOBOON_SECRET_KEY が設定されていません。',
  IDENTITY_MISSING:  'ユーザー識別情報がありません (idToken/lineUserId ともに未提供)。',
  IDENTITY_FAILED:   'ユーザーIDの取得に失敗しました。',
  INVALID_SPOT:      'INVALID_SPOT',
  VERIFY_FAILED:     'idToken 検証失敗',
};

var PROPERTY_KEYS = {
  SPREADSHEET_ID: 'ASOBOON_SPREADSHEET_ID',
  SECRET_KEY:     'ASOBOON_SECRET_KEY',
  LIFF_ID:        'ASOBOON_LIFF_ID',
  LINE_CHANNEL_ID:'LINE_CHANNEL_ID',
};
