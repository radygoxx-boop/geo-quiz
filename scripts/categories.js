// =====================================================================
//  分野・難易度の定義(ここが唯一の定義場所です)
// ---------------------------------------------------------------------
//  ・name は Notion の選択肢名と「1文字も違わず」同じにしてください。
//    (全角/半角、スペース、「・」の種類まで一致が必要です)
//  ・id は画像ファイル名(images/chars/{id}_1.svg など)に使います。
//  ・ここを書きかえたら、Actions で「Run workflow」を実行してください。
//    questions.json に新しい定義が書き込まれ、アプリにも反映されます。
// =====================================================================

const FIELDS = [
  { id: 'hokkaido_tohoku', name: '北海道・東北', icon: '🐻' },
  { id: 'kanto',           name: '関東',         icon: '🗼' },
  { id: 'chubu',           name: '中部',         icon: '🗻' },
  { id: 'kinki',           name: '近畿',         icon: '⛩️' },
  { id: 'chugoku_shikoku', name: '中国・四国',   icon: '🌉' },
  { id: 'kyushu',          name: '九州・沖縄',   icon: '🌋' },
  { id: 'world',           name: '世界地理',     icon: '🌏' },
  { id: 'industry',        name: '産業・地図',   icon: '🧭' },
];

// 「★」の後ろは半角スペース
const DIFFICULTIES = [
  { id: 'easy',   name: '★ やさしい' },
  { id: 'normal', name: '★★ ふつう' },
  { id: 'hard',   name: '★★★ むずかしい' },
];

const ANSWERS = ['A', 'B', 'C', 'D'];

// 取り込み対象のステータス
const PUBLISH_STATUS = '完成';
const ALL_STATUSES = ['下書き', 'レビュー待ち', '完成'];

// Notion のプロパティ名(列名)
const PROPS = {
  question: '問題文',
  choices: ['選択肢A', '選択肢B', '選択肢C', '選択肢D'],
  answer: '正解',
  difficulty: '難易度',
  field: '分野',
  hint: 'ヒント文',
  status: 'ステータス',
};

module.exports = { FIELDS, DIFFICULTIES, ANSWERS, PUBLISH_STATUS, ALL_STATUSES, PROPS };
