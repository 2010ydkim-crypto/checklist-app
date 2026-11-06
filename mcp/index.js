#!/usr/bin/env node
// 체크리스트 앱 MCP 서버
// Claude가 체크리스트(Supabase)의 할 일을 조회·추가·수정·삭제할 수 있게 해 줍니다.
// 로그인한 사용자 본인의 할 일만 다룹니다 (Supabase RLS 보안 규칙 적용).
//
// 필요한 환경 변수
//   CHECKLIST_EMAIL     체크리스트 사이트에 가입한 이메일
//   CHECKLIST_PASSWORD  그 계정의 비밀번호
// 선택 환경 변수 (기본값: 배포된 checklist-app 프로젝트)
//   SUPABASE_URL, SUPABASE_KEY(publishable 키)

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://hbcwhbgozeivkgvgqnpe.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'sb_publishable_F0_3AgbasjAQ5MUaRNwV5w_aP8BqdX1';
const TABLE = 'checklist_items';
const SITE = 'https://checklist-app-omega-eight.vercel.app';

const db = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: true },
});

/* ---------- 로그인 (첫 도구 호출 때 한 번) ---------- */
let loginPromise = null;
function ensureLogin() {
  if (!loginPromise) {
    loginPromise = (async () => {
      const email = process.env.CHECKLIST_EMAIL;
      const password = process.env.CHECKLIST_PASSWORD;
      if (!email || !password) {
        throw new Error('환경 변수 CHECKLIST_EMAIL, CHECKLIST_PASSWORD 가 설정되지 않았습니다. '
          + `${SITE} 에 가입한 계정 정보를 MCP 설정의 env 에 넣어 주세요.`);
      }
      const { data, error } = await db.auth.signInWithPassword({ email, password });
      if (error) throw new Error(`체크리스트 로그인 실패: ${error.message}`);
      return data.user;
    })();
    loginPromise.catch(() => { loginPromise = null; });   // 실패하면 다음 호출 때 다시 시도
  }
  return loginPromise;
}

/* ---------- 날짜 도우미 ---------- */
const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const today = () => ymd(new Date());
function pretty(s) {
  const [y, m, d] = s.split('-').map(Number);
  return `${y}년 ${m}월 ${d}일 (${WEEK[new Date(y, m - 1, d).getDay()]})`;
}
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD 형식이어야 합니다');

/* ---------- 결과 포맷 ---------- */
const ok = (text, data) => ({
  content: [{ type: 'text', text }],
  ...(data !== undefined ? { structuredContent: data } : {}),
});
const fail = err => ({ content: [{ type: 'text', text: `오류: ${err.message || err}` }], isError: true });
const row = i => `${i.done ? '[x]' : '[ ]'} ${i.text}  (id: ${i.id})`;

function formatByDate(items) {
  if (!items.length) return '해당하는 할 일이 없습니다.';
  const dates = [...new Set(items.map(i => i.date))].sort();
  return dates.map(d => {
    const list = items.filter(i => i.date === d);
    const done = list.filter(i => i.done).length;
    return `■ ${pretty(d)} — ${done}/${list.length} 완료\n${list.map(row).join('\n')}`;
  }).join('\n\n');
}
const pick = i => ({ id: i.id, text: i.text, done: i.done, date: i.date });

/* ---------- MCP 서버 ---------- */
const server = new McpServer({ name: 'checklist', version: '1.0.0' });

server.registerTool('list_items', {
  title: '할 일 목록 조회',
  description: '체크리스트의 할 일을 조회합니다. 날짜를 지정하지 않으면 오늘 할 일을 보여줍니다. '
    + 'from/to 로 기간을 지정하거나 all=true 로 전체를 볼 수 있습니다.',
  inputSchema: {
    date: dateSchema.optional().describe('특정 날짜 (YYYY-MM-DD). 생략하면 오늘'),
    from: dateSchema.optional().describe('기간 시작일 (YYYY-MM-DD)'),
    to: dateSchema.optional().describe('기간 종료일 (YYYY-MM-DD)'),
    all: z.boolean().optional().describe('true 면 모든 날짜의 할 일'),
    status: z.enum(['all', 'todo', 'done']).optional().describe('all(기본) / todo(진행 중) / done(완료)'),
  },
  annotations: { readOnlyHint: true },
}, async ({ date, from, to, all, status = 'all' }) => {
  try {
    await ensureLogin();
    let q = db.from(TABLE).select('id, text, done, date')
      .order('date', { ascending: true }).order('created_at', { ascending: true });
    let scope;
    if (from || to) {
      if (from) q = q.gte('date', from);
      if (to) q = q.lte('date', to);
      scope = `${from ? pretty(from) : '처음'} ~ ${to ? pretty(to) : '끝'}`;
    } else if (!all) {
      const d = date || today();
      q = q.eq('date', d);
      scope = pretty(d);
    } else {
      scope = '전체 기간';
    }
    if (status === 'todo') q = q.eq('done', false);
    if (status === 'done') q = q.eq('done', true);
    const { data, error } = await q;
    if (error) throw error;
    return ok(`[${scope}]\n${formatByDate(data)}`, { items: data.map(pick) });
  } catch (e) { return fail(e); }
});

server.registerTool('add_items', {
  title: '할 일 추가',
  description: '체크리스트에 할 일을 하나 이상 추가합니다. 날짜를 생략하면 오늘로 추가합니다.',
  inputSchema: {
    texts: z.array(z.string().trim().min(1).max(200)).min(1).max(50).describe('추가할 할 일 내용 목록'),
    date: dateSchema.optional().describe('날짜 (YYYY-MM-DD). 생략하면 오늘'),
  },
}, async ({ texts, date }) => {
  try {
    await ensureLogin();
    const d = date || today();
    const { data, error } = await db.from(TABLE)
      .insert(texts.map(text => ({ text, date: d })))
      .select('id, text, done, date');
    if (error) throw error;
    return ok(`${pretty(d)}에 ${data.length}개 추가했습니다.\n${data.map(row).join('\n')}`, { items: data.map(pick) });
  } catch (e) { return fail(e); }
});

server.registerTool('update_item', {
  title: '할 일 수정 / 완료 체크',
  description: '할 일의 완료 여부, 내용, 날짜를 바꿉니다. id 는 list_items 결과에서 확인하세요.',
  inputSchema: {
    id: z.string().uuid().describe('할 일 id'),
    done: z.boolean().optional().describe('완료 여부'),
    text: z.string().trim().min(1).max(200).optional().describe('새 내용'),
    date: dateSchema.optional().describe('옮길 날짜 (YYYY-MM-DD)'),
  },
  annotations: { idempotentHint: true },
}, async ({ id, ...patch }) => {
  try {
    await ensureLogin();
    const changes = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
    if (!Object.keys(changes).length) throw new Error('바꿀 내용(done, text, date 중 하나 이상)을 지정하세요.');
    const { data, error } = await db.from(TABLE).update(changes).eq('id', id).select('id, text, done, date');
    if (error) throw error;
    if (!data.length) throw new Error('해당 id 의 할 일을 찾을 수 없습니다.');
    return ok(`수정했습니다: ${pretty(data[0].date)} ${row(data[0])}`, { item: pick(data[0]) });
  } catch (e) { return fail(e); }
});

server.registerTool('delete_items', {
  title: '할 일 삭제',
  description: '할 일을 삭제합니다. 되돌릴 수 없으므로 사용자가 삭제를 원할 때만 사용하세요.',
  inputSchema: {
    ids: z.array(z.string().uuid()).min(1).max(100).describe('삭제할 할 일 id 목록'),
  },
  annotations: { destructiveHint: true },
}, async ({ ids }) => {
  try {
    await ensureLogin();
    const { data, error } = await db.from(TABLE).delete().in('id', ids).select('id, text, done, date');
    if (error) throw error;
    return ok(data.length ? `${data.length}개 삭제했습니다.\n${data.map(row).join('\n')}` : '삭제된 항목이 없습니다 (id 확인 필요).',
      { deleted: data.map(pick) });
  } catch (e) { return fail(e); }
});

server.registerTool('summary', {
  title: '진행 현황 요약',
  description: '기간별 할 일 진행률(완료/전체)을 날짜별로 요약합니다. 기간을 생략하면 최근 7일입니다.',
  inputSchema: {
    from: dateSchema.optional().describe('시작일 (YYYY-MM-DD). 생략하면 6일 전'),
    to: dateSchema.optional().describe('종료일 (YYYY-MM-DD). 생략하면 오늘'),
  },
  annotations: { readOnlyHint: true },
}, async ({ from, to }) => {
  try {
    await ensureLogin();
    const end = to || today();
    const start = from || (() => { const d = new Date(); d.setDate(d.getDate() - 6); return ymd(d); })();
    const { data, error } = await db.from(TABLE).select('date, done').gte('date', start).lte('date', end);
    if (error) throw error;
    const byDate = {};
    data.forEach(i => { (byDate[i.date] ||= { total: 0, done: 0 }).total++; if (i.done) byDate[i.date].done++; });
    const days = Object.keys(byDate).sort().map(d => ({ date: d, ...byDate[d] }));
    const total = data.length, done = data.filter(i => i.done).length;
    const pct = n => (n.total ? Math.round(n.done / n.total * 100) : 0);
    const lines = days.map(d => `${pretty(d.date)}: ${d.done}/${d.total} (${pct(d)}%)`);
    const text = `[${pretty(start)} ~ ${pretty(end)}]\n`
      + (lines.length ? lines.join('\n') : '이 기간에는 할 일이 없습니다.')
      + `\n\n합계: ${done}/${total} 완료 (${pct({ total, done })}%)`;
    return ok(text, { from: start, to: end, total, done, days });
  } catch (e) { return fail(e); }
});

await server.connect(new StdioServerTransport());
console.error('checklist MCP 서버가 시작되었습니다.');
