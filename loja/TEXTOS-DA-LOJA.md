# Kit para a Chrome Web Store

Textos prontos para colar no painel do desenvolvedor (https://chrome.google.com/webstore/devconsole), aba por aba.

---

## Pacote

Envie o arquivo **`captura-pagina-inteira-1.2.1.zip`**. Ele contém só os arquivos da extensão, sem o README e as imagens desta pasta.

---

## Aba "Store listing" (Página da loja)

**Nome** (vem do manifest): `Captura Página Inteira`

**Resumo** (vem do manifest, até 132 caracteres):
> Rola a página automaticamente, captura cada tela e gera um PDF (ou PNG) da página inteira.

**Descrição** (copie tudo entre as linhas):

---
Capture uma página da web inteira, do topo ao rodapé, e salve como PDF ou PNG com um clique.

A Captura Página Inteira rola a página sozinha, tira um print de cada tela e junta tudo em um único arquivo, sem emendas aparentes. É ideal para guardar artigos, documentos, receitas, pesquisas, comprovantes ou qualquer página que não cabe na tela.

★ RECURSOS
• Página inteira com um clique (ou atalho Alt+Shift+P)
• Cabeçalhos e menus fixos aparecem só uma vez, sem se repetir no meio do arquivo
• Funciona em sites tipo aplicativo, em que só uma parte da tela rola (como o Gmail e o Google Drive)
• Uma folha do documento por página: ao capturar um PDF aberto no visualizador do Google Drive, cada folha vira uma página do arquivo final, sem o fundo cinza e com a orientação certa
• Quebra de página inteligente, que não corta linhas de texto ao meio
• PDF em A4, Carta ou página única contínua, com margem e qualidade ajustáveis
• Também salva como imagem PNG
• Espera ajustável para sites que carregam as imagens enquanto você rola
• Totalmente em português

★ PRIVACIDADE
Tudo acontece no seu computador. A extensão não coleta, não envia e não vende nenhum dado: não há servidores, contas, anúncios nem rastreamento. O código é aberto e pode ser conferido no GitHub.

★ COMO USAR
1. Abra a página que deseja capturar.
2. Clique no ícone da extensão e em "Capturar página inteira".
3. Aguarde a rolagem automática sem trocar de aba.
4. Na aba de resultado, escolha o formato e clique em "Baixar PDF".

Observação: por regra do Chrome, páginas internas do navegador (chrome://) e a própria Chrome Web Store não podem ser capturadas.
---

**Categoria:** Ferramentas (Tools), em Produtividade

**Idioma:** Português (Brasil)

**Imagens:**

| Campo | Arquivo |
|---|---|
| Ícone da loja (128x128) | `icone-128.png` |
| Capturas de tela (1280x800) | `captura-1.png`, `captura-2.png`, `captura-3.png` |
| Bloco promocional pequeno (440x280) | `promo-pequeno-440x280.png` |
| Bloco promocional grande (1400x560, opcional) | `promo-grande-1400x560.png` |

**Site oficial / página inicial:** `https://github.com/daisonpaz/captura-pagina-inteira`

**URL de suporte:** `https://github.com/daisonpaz/captura-pagina-inteira/issues`

---

## Aba "Privacy" (Práticas de privacidade)

**Finalidade única (Single purpose description):**
> Capturar a página da web aberta por inteiro, rolando-a automaticamente e juntando os prints de cada tela em um arquivo PDF ou PNG que o usuário pode baixar.

**Justificativa das permissões:**

`activeTab`
> Usada para tirar os prints da aba atual com chrome.tabs.captureVisibleTab, somente depois que o usuário clica no ícone da extensão (ou usa o atalho) e pede a captura. A extensão não acessa nenhuma outra aba.

`scripting`
> Usada para executar, apenas na aba atual e apenas durante a captura pedida pelo usuário, uma função que rola a página, mede a altura do conteúdo e esconde temporariamente cabeçalhos fixos, para que eles não se repitam no arquivo. Ao final, a página volta ao estado original.

`storage`
> Usada para guardar localmente as preferências do usuário (tempo de espera entre as telas) e a última mensagem de erro, para exibi-la na janela da extensão. Nenhum dado é enviado para fora do navegador.

**Código remoto (Remote code):**
> Marque **"No, I am not using remote code"**. Todo o código está dentro do pacote; não há bibliotecas externas.

**Uso de dados (Data usage):**
- Na lista "What user data do you plan to collect", marque **"Conteúdo do site" (Website content)**. Os prints da página são processados e guardados localmente no navegador, e as regras da loja pedem que isso seja declarado mesmo sem envio para fora. Não marque mais nada.
- Marque as três declarações de conformidade:
  - Não vendo nem transfiro dados de usuários para terceiros, fora dos casos de uso aprovados
  - Não uso nem transfiro dados de usuários para fins não relacionados à finalidade única do item
  - Não uso nem transfiro dados de usuários para determinar crédito ou conceder empréstimos

**Política de privacidade (Privacy policy URL):**
> `https://github.com/daisonpaz/captura-pagina-inteira/blob/main/PRIVACY.md`

---

## Aba "Distribution" (Distribuição)

- **Visibilidade:** Público
- **Regiões:** Todas (ou só o Brasil, se preferir)
- **Preço:** Gratuito

---

## Antes de enviar

- [ ] Conta de desenvolvedor criada e taxa paga
- [ ] Verificação em duas etapas ativada na conta Google
- [ ] Zip enviado
- [ ] Todas as abas preenchidas (o botão "Submit for review" só libera quando tudo estiver completo)
