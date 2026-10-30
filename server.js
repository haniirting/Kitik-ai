// Посредник: TikTok LIVE (подарки и комментарии) -> ИИ -> страница Китики по WebSocket
import { WebSocketServer } from 'ws';

const USER = (process.env.TIKTOK_USER || '').replace(/^@/, '');
const PORT = +process.env.PORT || 8080;
const CLAUDE_KEY = process.env.ANTHROPIC_API_KEY;
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-haiku-5-5';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.1';

if (!USER) { console.log('Укажи ник в TIKTOK_USER (файл start.bat)'); process.exit(1); }

let persona = 'Тебя зовут Китика, ты ИИ-ведущая TikTok LIVE. Отвечай по-русски, коротко и дружелюбно.';

const wss = new WebSocketServer({ port: PORT });
wss.on('connection', ws => {
  console.log('Страница подключилась');
  ws.on('message', m => {
    try { const d = JSON.parse(m); if (d.type === 'hello' && d.persona) persona = d.persona; } catch {}
  });
});
const send = o => { const s = JSON.stringify(o); wss.clients.forEach(c => c.readyState === 1 && c.send(s)); };
console.log('Ждём страницу на ws://localhost:' + PORT);

// --- ИИ: ключ Claude, если он задан, иначе локальная Ollama
async function ai(text, user) {
  const sys = persona + ' Ответ: одно-два коротких предложения, не длиннее 120 символов, без списков.';
  const msg = user + ' пишет: ' + text;
  const signal = AbortSignal.timeout(8000);
  if (CLAUDE_KEY) {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', signal,
      headers: { 'content-type': 'application/json', 'x-api-key': CLAUDE_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: CLAUDE_MODEL, max_tokens: 150, system: sys, messages: [{ role: 'user', content: msg }] })
    });
    const d = await r.json();
    return d.content?.[0]?.text?.trim();
  }
  const r = await fetch('http://localhost:11434/api/chat', {
    method: 'POST', signal, headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: OLLAMA_MODEL, stream: false, messages: [{ role: 'system', content: sys }, { role: 'user', content: msg }] })
  });
  const d = await r.json();
  return d.message?.content?.trim();
}

// --- комментарии: отвечаем не чаще, чем раз в 6 секунд
let busy = false;
async function onChat(user, text) {
  if (busy || text.length < 2) return;
  busy = true;
  console.log('Комментарий:', user + ':', text);
  let reply;
  try { reply = await ai(text, user); } catch (e) { console.log('Ошибка ИИ (отвечу шаблоном):', e.message); }
  send({ type: 'comment', user, text, reply: reply ? reply.slice(0, 200) : undefined });
  setTimeout(() => { busy = false; }, 6000);
}

// --- подарки
const recent = new Map();
function onGift(d) {
  const name = d.giftName || d.giftDetails?.giftName || d.extendedGiftInfo?.name || d.gift?.name || String(d.giftId);
  const user = d.user?.uniqueId || d.uniqueId || '';
  console.log('Подарок:', name, 'от', user);
  const key = user + name, now = Date.now();
  if (now - (recent.get(key) || 0) < 4000) return;
  recent.set(key, now);
  send({ type: 'gift', gift: name });
}

// --- подключение к эфиру
const tl = await import('tiktok-live-connector');
const L = { ...(tl.default || {}), ...tl };
const Conn = L.TikTokLiveConnection || L.WebcastPushConnection;
const EV = L.WebcastEvent;
let timer = null;
const later = () => { if (!timer) timer = setTimeout(() => { timer = null; start(); }, 10000); };

async function start() {
  const c = new Conn(USER, { enableExtendedGiftInfo: true });
  c.on(EV ? EV.CHAT : 'chat', d => onChat(d.user?.uniqueId || d.uniqueId || 'зритель', d.comment || ''));
  c.on(EV ? EV.GIFT : 'gift', onGift);
  c.on((L.ControlEvent && L.ControlEvent.DISCONNECTED) || (EV && EV.DISCONNECTED) || 'disconnected', () => {
    console.log('Отключено от эфира, пробую снова через 10 секунд');
    later();
  });
  try {
    await c.connect();
    console.log('Подключено к эфиру @' + USER);
  } catch (e) {
    console.log('Не удалось подключиться (эфир идёт?):', e.message || e);
    later();
  }
}
start();
