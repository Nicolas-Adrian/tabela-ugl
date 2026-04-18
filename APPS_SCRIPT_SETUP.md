# Google Sheets + Apps Script

## 1. Criar a planilha

1. Crie uma planilha no Google Sheets.
2. Dê um nome para ela, por exemplo `Free Fire Overlay`.

## 2. Criar o Apps Script

1. Na planilha, clique em `Extensões > Apps Script`.
2. Apague o conteúdo do arquivo padrão.
3. Cole o conteúdo de [apps-script-code.gs](/C:/Users/pasto/OneDrive/Desktop/vscode/ugl/free-fire/apps-script-code.gs).
4. Salve o projeto.

## 3. Publicar como Web App

Segundo a documentação oficial do Google, web apps do Apps Script usam `doGet(e)` e `doPost(e)` e podem retornar JSON via `ContentService`:
- [Web Apps](https://developers.google.com/apps-script/guides/web)
- [ContentService](https://developers.google.com/apps-script/guides/content)

Passos:

1. Clique em `Implantar > Nova implantação`.
2. Em tipo, escolha `Aplicativo da web`.
3. Em `Executar como`, escolha `Eu`.
4. Em `Quem tem acesso`, escolha `Qualquer pessoa`.
5. Clique em `Implantar`.
6. Copie a URL terminada em `/exec`.

## 4. Ligar o site ao Apps Script

1. Abra [apps-script-config.js](/C:/Users/pasto/OneDrive/Desktop/vscode/ugl/free-fire/apps-script-config.js).
2. Cole a URL do web app em `webAppUrl`.

Exemplo:

```js
export const appsScriptConfig = {
  webAppUrl: "https://script.google.com/macros/s/SEU_ID/exec"
};
```

## 5. Publicar no GitHub Pages

1. Suba os arquivos para um repositório no GitHub.
2. Vá em `Settings > Pages`.
3. Em `Source`, escolha a branch principal e a pasta `/root`.
4. Salve.
5. Aguarde a URL pública do GitHub Pages.

## 6. Como usar

1. Abra `index.html` no GitHub Pages.
2. Edite os times normalmente.
3. Abra `presentation.html` no navegador ou no OBS.
4. O overlay vai consultar o Apps Script periodicamente e refletir as mudanças.

## 7. Teste rápido

Abra no navegador a URL do Apps Script com `?mode=read`.

Exemplo:

```txt
https://script.google.com/macros/s/SEU_ID/exec?mode=read
```

Se estiver certo, deve aparecer um JSON com `ok: true`.
