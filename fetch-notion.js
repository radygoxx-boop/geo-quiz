#!/usr/bin/env node
// =====================================================================
//  Notion の問題DB → questions.json 同期スクリプト
//  使い方: NOTION_API_KEY=xxx NOTION_DATABASE_ID=yyy node scripts/fetch-notion.js
//  任意:   FORCE_SYNC=true で変更チェックを飛ばして全件取り込み
// =====================================================================
'use strict';

const fs = require('fs');
const path = require('path');
const {
  FIELDS, DIFFICULTIES, ANSWERS, PUBLISH_STATUS, ALL_STATUSES, PROPS,
} = require('./categories');

const OUTPUT = path.join(__dirname, '..', 'questions.json');
// Notion の last_edited_time は分単位に丸められるため、少し前から確認する
const SAFETY_MARGIN_MS = 2 * 60 * 1000;

const warnings = [];
function warn(msg) {
  warnings.push(msg);
  // GitHub Actions のログで黄色い警告として表示される
  console.log(`::warning::${msg}`);
}

// 空白(半角・全角)を除いた比較用の文字列
const squash = (s) => String(s || '').replace(/[\s\u3000]+/g, '');

// ---------------------------------------------------------------------
//  Notion のプロパティから値を取り出す
// ---------------------------------------------------------------------
function plainText(prop) {
  if (!prop) return '';
  const arr = prop.type === 'title' ? prop.title : prop.rich_text;
  if (!Array.isArray(arr)) return '';
  return arr.map((t) => t.plain_text || '').join('').trim();
}

function optionName(prop) {
  if (!prop) return '';
  if (prop.type === 'select') return (prop.select && prop.select.name || '').trim();
  if (prop.type === 'status') return (prop.status && prop.status.name || '').trim();
  if (prop.type === 'rich_text' || prop.type === 'title') return plainText(prop);
  return '';
}

// 定義と完全一致 → そのまま。空白違いだけなら警告して受け入れる。それ以外は null
function matchName(value, list, label, where) {
  const exact = list.find((x) => x.name === value);
  if (exact) return exact;
  const loose = list.find((x) => squash(x.name) === squash(value));
  if (loose && value) {
    warn(`${where}: ${label}「${value}」は表記ゆれです(正しくは「${loose.name}」)。今回は取り込みましたが、Notion側を直してください。`);
    return loose;
  }
  return null;
}

// ---------------------------------------------------------------------
//  1ページ → 1問 に変換(不正ならスキップ理由を返す)
// ---------------------------------------------------------------------
function pageToQuestion(page) {
  const p = page.properties || {};
  const question = plainText(p[PROPS.question]);
  const where = `問題「${question ? question.slice(0, 30) : '(問題文なし)'}」(${page.url || page.id})`;

  if (!question) return { skip: `${where}: 問題文がありません` };

  const choices = PROPS.choices.map((name) => plainText(p[name]));
  const filled = choices.filter((c) => c !== '');
  if (filled.length < 4) return { skip: `${where}: 選択肢が4つそろっていません(${filled.length}個)` };

  const ansRaw = optionName(p[PROPS.answer]).toUpperCase().replace(/[Ａ-Ｄ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
  const answer = ANSWERS.indexOf(ansRaw);
  if (answer < 0) return { skip: `${where}: 正解が A〜D ではありません(「${ansRaw || '未入力'}」)` };

  const fieldName = optionName(p[PROPS.field]);
  const field = matchName(fieldName, FIELDS, '分野', where);
  if (!field) return { skip: `${where}: 分野「${fieldName || '未入力'}」が定義にありません(scripts/categories.js を確認)` };

  const diffName = optionName(p[PROPS.difficulty]);
  const diff = matchName(diffName, DIFFICULTIES, '難易度', where);
  if (!diff) return { skip: `${where}: 難易度「${diffName || '未入力'}」が定義にありません(scripts/categories.js を確認)` };

  const seen = new Set();
  const dup = choices.filter((c) => (seen.has(c) ? true : (seen.add(c), false)));
  if (dup.length) warn(`${where}: 選択肢が重複しています(「${[...new Set(dup)].join('」「')}」)`);

  return {
    fieldName: field.name,
    item: {
      question,
      choices,
      answer,
      hint: plainText(p[PROPS.hint]),
      difficulty: diff.name,
    },
  };
}

// 全ページ → questions.json の中身
function buildOutput(pages, now) {
  const questions = {};
  FIELDS.forEach((f) => { questions[f.name] = []; });
  let ok = 0;
  pages.forEach((page) => {
    const r = pageToQuestion(page);
    if (r.skip) { warn(`スキップ: ${r.skip}`); return; }
    questions[r.fieldName].push(r.item);
    ok += 1;
  });
  return {
    count: ok,
    json: {
      generatedAt: now.toISOString(),
      fields: FIELDS,
      difficulties: DIFFICULTIES,
      questions,
    },
  };
}

// ---------------------------------------------------------------------
//  DBの列や選択肢が定義と合っているか確認(合わなければ警告)
// ---------------------------------------------------------------------
function checkSchema(db) {
  const props = db.properties || {};
  const need = [PROPS.question, ...PROPS.choices, PROPS.answer, PROPS.difficulty, PROPS.field, PROPS.hint, PROPS.status];
  need.forEach((name) => {
    if (!props[name]) warn(`Notion DB に列「${name}」がありません。列名を確認してください。`);
  });

  const options = (prop) => {
    if (!prop) return [];
    const box = prop[prop.type];
    return box && Array.isArray(box.options) ? box.options.map((o) => o.name) : [];
  };
  const compare = (propName, expected) => {
    const actual = options(props[propName]);
    if (!actual.length) return;
    expected.filter((e) => !actual.includes(e))
      .forEach((e) => warn(`列「${propName}」に選択肢「${e}」がありません(Notion側に同じ名前で作ってください)`));
    actual.filter((a) => !expected.includes(a))
      .forEach((a) => warn(`列「${propName}」の選択肢「${a}」はアプリの定義にありません。この選択肢の問題は取り込まれません。`));
  };
  compare(PROPS.field, FIELDS.map((f) => f.name));
  compare(PROPS.difficulty, DIFFICULTIES.map((d) => d.name));
  compare(PROPS.answer, ANSWERS);
  compare(PROPS.status, ALL_STATUSES);

  const st = props[PROPS.status];
  // 自動連番(ID)列があれば、それで並べる(作成日時は分単位なので同じ分に作った問題の順が崩れるため)
  const orderProp = Object.keys(props).find((k) => props[k] && props[k].type === 'unique_id') || null;
  return { statusType: st && st.type === 'status' ? 'status' : 'select', orderProp };
}

// ---------------------------------------------------------------------
//  メイン処理
// ---------------------------------------------------------------------
function normalizeDbId(raw) {
  const s = String(raw || '').trim();
  const m = s.replace(/-/g, '').match(/[0-9a-f]{32}/i);
  return m ? m[0] : s;
}

function readPrevious() {
  try {
    return JSON.parse(fs.readFileSync(OUTPUT, 'utf8'));
  } catch (e) {
    return null;
  }
}

function sameContent(a, b) {
  if (!a || !b) return false;
  return JSON.stringify({ f: a.fields, d: a.difficulties, q: a.questions })
    === JSON.stringify({ f: b.fields, d: b.difficulties, q: b.questions });
}

function summary(lines) {
  if (!process.env.GITHUB_STEP_SUMMARY) return;
  try { fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join('\n') + '\n'); } catch (e) { /* 無視 */ }
}

async function main() {
  const apiKey = (process.env.NOTION_API_KEY || '').trim();
  const dbId = normalizeDbId(process.env.NOTION_DATABASE_ID);
  if (!apiKey || !dbId) {
    console.error('::error::NOTION_API_KEY または NOTION_DATABASE_ID が設定されていません(Settings → Secrets and variables → Actions)');
    process.exit(1);
  }

  const { Client } = require('@notionhq/client');
  const notion = new Client({ auth: apiKey });

  const db = await notion.databases.retrieve({ database_id: dbId });
  const { statusType, orderProp } = checkSchema(db);
  console.log(orderProp ? `並び順: 列「${orderProp}」(自動連番)の昇順` : '並び順: 作成日時の昇順(自動連番の列がないため)');

  const prev = readPrevious();
  const force = String(process.env.FORCE_SYNC || '').toLowerCase() === 'true';
  const defsChanged = !prev
    || JSON.stringify(prev.fields) !== JSON.stringify(FIELDS)
    || JSON.stringify(prev.difficulties) !== JSON.stringify(DIFFICULTIES);
  const prevTime = prev && Date.parse(prev.generatedAt);

  // --- 変更検知: 前回同期以降に編集されたページが1件でもあるか ---
  if (!force && !defsChanged && prevTime) {
    const since = new Date(prevTime - SAFETY_MARGIN_MS).toISOString();
    const probe = await notion.databases.query({
      database_id: dbId,
      page_size: 1,
      filter: { timestamp: 'last_edited_time', last_edited_time: { after: since } },
    });
    if (!probe.results.length) {
      console.log(`NO_CHANGE(${prev.generatedAt} 以降の編集はありません)`);
      summary(['### NO_CHANGE', `${prev.generatedAt} 以降、Notionの編集はありませんでした。`]);
      return;
    }
    console.log('変更を検知しました。全件を取得します。');
  } else {
    console.log(force ? '強制同期(FORCE_SYNC)で全件を取得します。' : '初回または定義変更のため全件を取得します。');
  }

  // --- 全件取得(100件ずつ、追加した順) ---
  const pages = [];
  let cursor;
  do {
    const res = await notion.databases.query({
      database_id: dbId,
      page_size: 100,
      start_cursor: cursor,
      filter: { property: PROPS.status, [statusType]: { equals: PUBLISH_STATUS } },
      sorts: orderProp
        ? [{ property: orderProp, direction: 'ascending' }]
        : [{ timestamp: 'created_time', direction: 'ascending' }],
    });
    pages.push(...res.results);
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  console.log(`ステータス「${PUBLISH_STATUS}」のページ: ${pages.length}件`);

  const { json, count } = buildOutput(pages, new Date());

  if (count === 0) {
    warn('取り込める問題が0件でした。questions.json は更新しません(ステータスや分野名を確認してください)。');
    process.exitCode = 0;
    return;
  }
  if (sameContent(prev, json)) {
    console.log('NO_CHANGE(取り込み結果が前回と同じため書き出しません)');
    summary(['### NO_CHANGE', '編集はありましたが、アプリに出る内容は変わりませんでした。']);
    return;
  }

  fs.writeFileSync(OUTPUT, JSON.stringify(json, null, 2) + '\n', 'utf8');

  const lines = ['### questions.json を更新しました', '', '| 分野 | ' + DIFFICULTIES.map((d) => d.name).join(' | ') + ' |', '|---|' + DIFFICULTIES.map(() => '---').join('|') + '|'];
  FIELDS.forEach((f) => {
    const list = json.questions[f.name];
    lines.push(`| ${f.name} | ` + DIFFICULTIES.map((d) => list.filter((q) => q.difficulty === d.name).length).join(' | ') + ' |');
  });
  lines.push('', `合計 ${count} 問 / 警告 ${warnings.length} 件`);
  console.log(lines.join('\n'));
  summary(lines);
}

if (require.main === module) {
  main().catch((err) => {
    const code = err && err.code;
    let hint = '';
    if (code === 'unauthorized') hint = 'NOTION_API_KEY が正しいか確認してください。';
    else if (code === 'object_not_found') hint = 'NOTION_DATABASE_ID が正しいか、DBにインテグレーションを「接続」したか確認してください。';
    else if (code === 'validation_error') hint = '列名(特に「ステータス」)や型が仕様どおりか確認してください。';
    console.error(`::error::Notionとの同期に失敗しました: ${err && err.message}${hint ? ' / ' + hint : ''}`);
    process.exit(1);
  });
}

module.exports = { pageToQuestion, buildOutput, checkSchema };
