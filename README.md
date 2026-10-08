# Acervo de Jogos

Site estático (GitHub Pages) para marcar os jogos do acervo:

- 🟢 **borda verde** — sabemos jogar
- 🟠 **borda laranja** — temos interesse
- 🔴 **borda vermelha** — pretendemos vender

Páginas: `index.html` (acervo com capas e filtros) e `gerenciar.html` (adicionar, editar, excluir, importar/exportar).

Dados: a base inicial está em `data/jogos.json` (gerada da planilha). As alterações ficam salvas no
`localStorage` do navegador. Para tornar uma alteração "oficial", use **Exportar** e substitua `data/jogos.json`.
A camada de dados fica em `assets/store.js`, para trocar por um backend depois.

Rodar local: `python -m http.server 8765` e abrir http://localhost:8765
