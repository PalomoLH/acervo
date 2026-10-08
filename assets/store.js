// Armazenamento local do acervo. Por enquanto tudo fica no localStorage do navegador;
// a base inicial vem de data/jogos.json. Troque este módulo quando houver um backend.
const STORAGE_KEY = 'acervo.jogos.v1';

export const STATUS = {
  '': { label: 'Sem marcação', cor: 'var(--neutro)' },
  sabemos: { label: 'Sabemos jogar', cor: 'var(--verde)' },
  interesse: { label: 'Temos interesse', cor: 'var(--laranja)' },
  vender: { label: 'Para vender', cor: 'var(--vermelho)' },
};

export async function carregar() {
  try {
    const salvo = localStorage.getItem(STORAGE_KEY);
    if (salvo) return JSON.parse(salvo);
  } catch { /* storage indisponível: cai para a base */ }
  return carregarBase();
}

export async function carregarBase() {
  const resp = await fetch('data/jogos.json', { cache: 'no-cache' });
  return resp.json();
}

export function salvar(jogos) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(jogos));
  } catch (e) {
    alert('Não foi possível salvar no navegador: ' + e.message);
  }
}

export function limparLocal() {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignora */ }
}

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
