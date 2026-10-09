# Acervo de Jogos

Site estático (GitHub Pages) com o acervo de jogos: https://palomolh.github.io/acervo/

- 🟢 **borda verde**: sabemos jogar
- 🟠 **borda laranja**: queremos jogar (ainda não sabemos)
- 🔴 **borda vermelha**: para vender

## Como funciona

- **Visitantes** só veem o acervo.
- **Admin** clica em 🔒 Admin, digita a senha e pode marcar jogos e usar a página `gerenciar.html`.
- Cada alteração vira um commit em `data/jogos.json` pela API do GitHub. Não tem banco de dados nem servidor.
- A senha decifra um token do GitHub guardado criptografado (AES-GCM + PBKDF2) em `data/auth.json`.
  Para configurar ou trocar o token ou a senha, use `config.html`.
- Botão ☀️/🌙 alterna o tema claro/escuro.

Rodar local: `python -m http.server 8765` e abrir http://localhost:8765
