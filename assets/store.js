// Camada de dados do acervo.
// Leitura: qualquer pessoa lê data/jogos.json publicado no GitHub Pages.
// Escrita: só o admin. A senha decifra um token do GitHub (data/auth.json) que grava
// as alterações direto no repositório via API — cada lote de mudanças vira um commit.
const REPO = 'PalomoLH/acervo';
const BRANCH = 'main';
const ARQUIVO = 'data/jogos.json';
const API = `https://api.github.com/repos/${REPO}/contents/`;
const SESSAO = 'acervo.token';
const ITERACOES = 600000;

export const STATUS = {
  '': { label: 'Sem marcação', cor: 'var(--neutro)' },
  sabemos: { label: 'Sabemos jogar', cor: 'var(--verde)' },
  interesse: { label: 'Queremos jogar', cor: 'var(--laranja)' },
  vender: { label: 'Para vender', cor: 'var(--vermelho)' },
};

/* ---------- autenticação ---------- */

export function token() {
  try { return sessionStorage.getItem(SESSAO); } catch { return null; }
}

export function isAdmin() { return !!token(); }

export async function entrar(senha) {
  const resp = await fetch(`data/auth.json?t=${Date.now()}`, { cache: 'no-store' });
  if (!resp.ok) throw new Error('O acesso de admin ainda não foi configurado (veja config.html).');
  let tok;
  try {
    tok = await decifrar(await resp.json(), senha);
  } catch {
    throw new Error('Senha incorreta.');
  }
  const teste = await gh(tok, `https://api.github.com/repos/${REPO}`);
  if (teste.status === 401) throw new Error('O token salvo expirou ou foi revogado. Refaça a configuração em config.html.');
  try { sessionStorage.setItem(SESSAO, tok); } catch { /* sem sessão: vale só nesta página */ }
  return tok;
}

export function sair() {
  try { sessionStorage.removeItem(SESSAO); } catch { /* ignora */ }
}

async function chave(senha, salt, iteracoes) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(senha), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iteracoes },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export async function cifrar(segredo, senha) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const dados = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await chave(senha, salt, ITERACOES), new TextEncoder().encode(segredo));
  return { v: 1, iteracoes: ITERACOES, salt: bytesParaB64(salt), iv: bytesParaB64(iv), dados: bytesParaB64(new Uint8Array(dados)) };
}

async function decifrar(cfg, senha) {
  const k = await chave(senha, b64ParaBytes(cfg.salt), cfg.iteracoes);
  const claro = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64ParaBytes(cfg.iv) }, k, b64ParaBytes(cfg.dados));
  return new TextDecoder().decode(claro);
}

/* ---------- leitura ---------- */

export async function carregar() {
  const tok = token();
  if (tok) {
    try { return (await lerArquivo(tok, ARQUIVO)).json; } catch { /* cai para a versão publicada */ }
  }
  const resp = await fetch(`${ARQUIVO}?t=${Date.now()}`, { cache: 'no-store' });
  return resp.json();
}

function gh(tok, url, opcoes = {}) {
  return fetch(url, {
    cache: 'no-store',
    ...opcoes,
    headers: { Authorization: `Bearer ${tok}`, Accept: 'application/vnd.github+json', ...opcoes.headers },
  });
}

async function lerArquivo(tok, caminho) {
  const resp = await gh(tok, `${API}${caminho}?ref=${BRANCH}`);
  if (resp.status === 404) return { json: null, sha: undefined };
  if (!resp.ok) throw new Error(`GitHub respondeu ${resp.status} ao ler ${caminho}`);
  const info = await resp.json();
  return { json: JSON.parse(new TextDecoder().decode(b64ParaBytes(info.content))), sha: info.sha };
}

export async function gravarArquivo(tok, caminho, dados, mensagem, sha) {
  return gh(tok, API + caminho, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: mensagem,
      branch: BRANCH,
      sha,
      content: bytesParaB64(new TextEncoder().encode(JSON.stringify(dados, null, 1) + '\n')),
    }),
  });
}

export async function shaDe(tok, caminho) {
  return (await lerArquivo(tok, caminho)).sha;
}

/* ---------- escrita (fila de alterações) ---------- */
// As alterações viram operações; antes de gravar, relemos a versão mais nova do
// repositório e reaplicamos as operações, para não sobrescrever o que outro admin fez.

let fila = [];
let timer = null;
let enviando = false;
let estado = { tipo: 'ocioso' };
const ouvintes = new Set();

export function aoMudarSalvamento(fn) { ouvintes.add(fn); fn(estado); }
function emitir(tipo, msg) { estado = { tipo, msg }; ouvintes.forEach(fn => fn(estado)); }

export function salvarJogo(jogo) {
  fila.push({ tipo: 'set', jogo: structuredClone(jogo) });
  agendar();
}

export function excluirJogo(jogo) {
  fila.push({ tipo: 'del', id: jogo.id, nome: jogo.nome });
  agendar();
}

export function temPendencias() { return fila.length > 0 || enviando; }

function agendar() {
  emitir('pendente');
  clearTimeout(timer);
  timer = setTimeout(enviar, 1500);
}

function aplicar(jogos, ops) {
  for (const op of ops) {
    if (op.tipo === 'del') { jogos = jogos.filter(j => j.id !== op.id); continue; }
    const i = jogos.findIndex(j => j.id === op.jogo.id);
    if (i >= 0) jogos[i] = op.jogo; else jogos.push(op.jogo);
  }
  return jogos;
}

function mensagem(ops) {
  if (ops.length > 1) return `Acervo: ${ops.length} alterações`;
  const op = ops[0];
  if (op.tipo === 'del') return `Acervo: remove ${op.nome}`;
  return `Acervo: ${op.jogo.nome} → ${STATUS[op.jogo.status || ''].label}`;
}

export async function enviar() {
  if (enviando) { agendar(); return; }
  if (!fila.length) return;
  const tok = token();
  if (!tok) { emitir('erro', 'Sessão de admin encerrada. Entre de novo para salvar.'); return; }
  clearTimeout(timer);
  enviando = true;
  const lote = fila;
  fila = [];
  emitir('salvando');
  try {
    for (let tentativa = 0; ; tentativa++) {
      const { json, sha } = await lerArquivo(tok, ARQUIVO);
      const resp = await gravarArquivo(tok, ARQUIVO, aplicar(json || [], lote), mensagem(lote), sha);
      if (resp.ok) break;
      if ((resp.status === 409 || resp.status === 422) && tentativa < 3) continue;
      throw new Error(resp.status === 401 || resp.status === 403
        ? 'O token não tem permissão (expirou?). Refaça config.html.'
        : `GitHub respondeu ${resp.status}`);
    }
    enviando = false;
    if (fila.length) agendar(); else emitir('salvo');
  } catch (e) {
    enviando = false;
    fila = lote.concat(fila);
    emitir('erro', e.message);
  }
}

/* ---------- utilidades ---------- */

export function novoId() {
  return 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export function exportar(jogos) {
  const blob = new Blob([JSON.stringify(jogos, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'jogos.json';
  a.click();
  URL.revokeObjectURL(a.href);
}

export function todosDonos(jogos) {
  return [...new Set(jogos.flatMap(j => j.donos))].sort((a, b) => a.localeCompare(b));
}

export function normalizar(txt) {
  return txt.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function esc(t) {
  return String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}

function bytesParaB64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function b64ParaBytes(b64) {
  return Uint8Array.from(atob(b64.replace(/\s/g, '')), c => c.charCodeAt(0));
}
