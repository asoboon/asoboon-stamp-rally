// Config.gs — 定数定義。Code.gs から参照する。

var LIFF_ID = '2009888671-57TOefc3';

var DEFAULT_SPOTS = [
  {
    spotId: 'spot_01',
    spotName: 'みまもり',
    description: '保護者の方は必ずお子様の近くにいてください。',
    order: 1,
    active: true,
  },
  {
    spotId: 'spot_02',
    spotName: '飲食ルール',
    description: '食べ物は食べられません。飲み物は土足の場所でお願いします。',
    order: 2,
    active: true,
  },
  {
    spotId: 'spot_03',
    spotName: '順番',
    description: '順番や回数を守って遊びましょう。',
    order: 3,
    active: true,
  },
  {
    spotId: 'spot_04',
    spotName: '入退場',
    description: '退場の際はロッカーを空っぽにしてください。',
    order: 4,
    active: true,
  },
];

var SHEET_NAMES = {
  spots:    'spots',
  stamps:   'stamps',
  claims:   'claims',
  settings: 'settings',
};
