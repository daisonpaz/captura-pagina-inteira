# Política de Privacidade: Captura Página Inteira

*Última atualização: 25 de novembro de 2026*

A extensão **Captura Página Inteira** foi feita para funcionar inteiramente no seu computador. Esta política explica quais dados ela usa e o que acontece com eles.

## Resumo

- A extensão **não coleta, não envia e não vende** nenhum dado.
- Nada sai do seu navegador: não há servidores, contas, anúncios nem estatísticas de uso.
- Os prints ficam guardados só no seu navegador, até a próxima captura.

## Quais dados a extensão usa

**Imagens da página capturada.** Quando você clica em "Capturar página inteira", a extensão rola a aba atual e tira prints da parte visível. Esses prints, junto com o título e o endereço da página (usados para dar nome ao arquivo), ficam guardados temporariamente no armazenamento interno do navegador (IndexedDB). Eles servem apenas para montar o PDF ou PNG na aba de resultado. Cada nova captura apaga a anterior.

**Preferências.** A extensão guarda no navegador algumas escolhas suas, como o tempo de espera entre as telas e a forma de dividir as páginas do PDF, além da última mensagem de erro, se houver.

**Conteúdo da página.** Para rolar a página e esconder temporariamente cabeçalhos fixos, a extensão executa um pequeno script **apenas na aba em que você clicou**, e **somente quando você pede a captura**. Ela não lê formulários, senhas nem o texto da página, e não funciona em segundo plano em outros sites.

## Compartilhamento

Nenhum dado é transmitido para o desenvolvedor nem para terceiros. Os arquivos PDF e PNG gerados são salvos apenas onde você escolher baixá-los.

## Permissões

| Permissão | Para que serve |
|---|---|
| `activeTab` | Tirar os prints da aba atual, só depois de você clicar no ícone |
| `scripting` | Rolar a página, medir a altura dela e esconder cabeçalhos fixos durante a captura |
| `storage` | Guardar as suas preferências |

## Como apagar os dados

Os prints são substituídos a cada nova captura. Para apagar tudo, remova a extensão em `chrome://extensions`: o navegador apaga junto todos os dados guardados por ela.

## Código aberto

O código completo está em <https://github.com/daisonpaz/captura-pagina-inteira> e pode ser conferido por qualquer pessoa.

## Contato

Dúvidas ou sugestões: abra uma *issue* em <https://github.com/daisonpaz/captura-pagina-inteira/issues>.

---

## Privacy Policy (English summary)

Captura Página Inteira ("Full Page Capture") runs entirely on your device. It does **not** collect, transmit, sell or share any user data. The screenshots of the page you choose to capture, plus its title and URL (used for the file name), are stored temporarily in the browser's local storage (IndexedDB) only to build the PDF/PNG, and are replaced by the next capture. User preferences are stored locally with `chrome.storage`. A script runs only on the active tab, only when you start a capture, to scroll the page and temporarily hide fixed headers. There are no servers, analytics or ads. Uninstalling the extension removes all its stored data. Contact: <https://github.com/daisonpaz/captura-pagina-inteira/issues>.
