# Plataforma de Controle Financeiro Operacional

Aplicação web para controlar serviços comprados de fornecedores externos, recebimentos, pagamentos, lucro, fornecedores, relatórios, importação e exportação.

## Como abrir

Abra `index.html` no navegador ou sirva a pasta em um servidor local.

Credenciais iniciais:

- ADMIN: `admin@empresa.com` / `admin123`
- OPERADOR: `operador@empresa.com` / `op123`

## Recursos incluídos

- Login, logout e sessão local.
- Perfis ADMIN e OPERADOR.
- Cadastro e edição de serviços.
- Cadastro, edição, exclusão e inativação de fornecedores.
- Cálculo automático de lucro.
- Separação por PIX, BOLETO, DINHEIRO e CARTAO.
- Filtro manual por período, estado, recebimento, fornecedor e status.
- Busca rápida por placa, estado, fornecedor, serviço, data e valor.
- Dashboard com cards financeiros, gráficos e visão diária.
- Tooltip nos gráficos com valor, quantidade e percentual.
- Relatórios por estado, fornecedor e detalhamento.
- Exportação CSV e Excel.
- Relatório A4 para impressão ou geração de PDF pelo navegador.
- Importação CSV/TSV/TXT e leitura XLSX quando o navegador oferecer `DecompressionStream`.
- Botão para baixar planilha modelo CSV preenchida com exemplos.
- Área de importação com drag-and-drop, barra de progresso, validação por linha/coluna, preview editável, exclusão de linhas e resumo financeiro antes de salvar.
- Fluxo obrigatório de prévia: anexar, ler, revisar, editar/cancelar e só então confirmar importação.
- Aceite de CSV, TSV, TXT, XLSX, OFX, OFC, PDF, JPG, JPEG, PNG e WEBP.
- CSV/XLSX/OFX/OFC têm leitura estruturada local; PDF e imagens ficam preparados para OCR/IA externo e geram prévia pendente para revisão manual nesta versão estática.
- Histórico de importações confirmadas e canceladas.
- Detecção de duplicidade por data, placa, valor, estado e tipo de recebimento.

Os dados ficam salvos no `localStorage` do navegador nesta versão inicial.
