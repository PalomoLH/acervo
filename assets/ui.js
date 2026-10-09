// Cabeçalho compartilhado: tema claro/escuro, login de admin e indicador de salvamento.
import { isAdmin, entrar, sair, aoMudarSalvamento, enviar, temPendencias } from './store.js';

const TEMA = 'acervo.tema';

function temaEfetivo() {
  return document.documentElement.dataset.theme
    || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
}

export function montarTopo(aoMudarAdmin) {
  const btnTema = document.getElementById('tema');
  const btnAdmin = document.getElementById('admin');
  const status = document.getElementById('salvamento');

  const pintarTema = () => {
    const escuro = temaEfetivo() === 'dark';
    btnTema.textContent = escuro ? '☀️' : '🌙';
    btnTema.title = escuro ? 'Mudar para tema claro' : 'Mudar para tema escuro';
  };
  btnTema.onclick = () => {
    const novo = temaEfetivo() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = novo;
    try { localStorage.setItem(TEMA, novo); } catch { /* ignora */ }
    pintarTema();
  };
  pintarTema();

  document.body.insertAdjacentHTML('beforeend', `
    <dialog id="dlgLogin">
      <form method="dialog" id="formLogin">
        <h2 style="margin:0;font-size:18px">Entrar como admin</h2>
        <label>Senha<input type="password" name="senha" autocomplete="current-password" required></label>
        <p id="erroLogin" class="erro"></p>
        <div class="linha-botoes">
          <button value="cancelar" formnovalidate>Cancelar</button>
          <button value="entrar" class="primario" id="btnEntrar">Entrar</button>
        </div>
      </form>
    </dialog>`);
  const dlg = document.getElementById('dlgLogin');
  const form = document.getElementById('formLogin');

  form.addEventListener('submit', async e => {
    if (e.submitter?.value !== 'entrar') return;
    e.preventDefault();
    const btn = document.getElementById('btnEntrar');
    btn.disabled = true;
    btn.textContent = 'Verificando…';
    document.getElementById('erroLogin').textContent = '';
    try {
      await entrar(form.senha.value);
      dlg.close();
      pintarAdmin();
      aoMudarAdmin();
    } catch (err) {
      document.getElementById('erroLogin').textContent = err.message;
    } finally {
      btn.disabled = false;
      btn.textContent = 'Entrar';
    }
  });

  const pintarAdmin = () => {
    btnAdmin.textContent = isAdmin() ? 'Sair do admin' : '🔒 Admin';
    document.body.classList.toggle('admin', isAdmin());
  };
  btnAdmin.onclick = () => {
    if (isAdmin()) {
      if (temPendencias() && !confirm('Há alterações ainda não salvas. Sair mesmo assim?')) return;
      sair();
      pintarAdmin();
      aoMudarAdmin();
    } else {
      form.reset();
      document.getElementById('erroLogin').textContent = '';
      dlg.showModal();
    }
  };
  pintarAdmin();

  aoMudarSalvamento(({ tipo, msg }) => {
    status.dataset.tipo = tipo;
    status.innerHTML = {
      ocioso: '',
      pendente: 'Alterações pendentes…',
      salvando: 'Salvando…',
      salvo: 'Salvo ✓',
      erro: `Erro ao salvar: ${msg} <button id="tentar">Tentar de novo</button>`,
    }[tipo];
    document.getElementById('tentar')?.addEventListener('click', enviar);
  });

  addEventListener('beforeunload', e => { if (temPendencias()) e.preventDefault(); });
}
