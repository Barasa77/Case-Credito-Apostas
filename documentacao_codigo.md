# Documentação — Pipeline de Análise de Risco de Crédito × Comportamento de Apostas

Documentação do script `pipeline_analise_credito_apostas.py`, que consolida todas as etapas do case: raio-X inicial, limpeza/padronização, join das bases e testes estatísticos.

---

## 1. Visão geral

| | |
|---|---|
| **Linguagem** | Python 3.9+ |
| **Bibliotecas** | pandas, numpy, scipy, statsmodels |
| **Entradas** | `contratos.csv`, `transacoes_apostas.csv` (separador `;`, UTF-8 com BOM) |
| **Saídas** | `contratos_limpo.csv`, `transacoes_apostas_limpo.csv`, `contratos_apostas_join.csv` |
| **Execução** | `python pipeline_analise_credito_apostas.py` |

## 2. Como rodar no VSCode

1. **Instale o Python** (3.9 ou superior) e a extensão oficial *Python* no VSCode.
2. **Crie um ambiente virtual** (recomendado, evita conflito com outros projetos):
   ```bash
   python -m venv .venv
   .venv\Scripts\activate        # Windows
   source .venv/bin/activate     # Mac/Linux
   ```
3. **Instale as dependências**:
   ```bash
   pip install pandas numpy scipy statsmodels
   ```
4. **Organize as pastas** assim (o script cria `saida/` sozinho, mas `dados/` precisa existir com os CSVs dentro):
   ```
   projeto/
   ├── pipeline_analise_credito_apostas.py
   └── dados/
       ├── contratos.csv
       └── transacoes_apostas.csv
   ```
5. **Rode**: pressione `F5` no VSCode (com o arquivo aberto) ou, pelo terminal integrado:
   ```bash
   python pipeline_analise_credito_apostas.py
   ```
6. Os três CSVs de saída aparecem em `projeto/saida/`, e o console imprime o raio-X, o relatório de limpeza, o resultado do join e o resumo dos testes estatísticos.

Se seus arquivos estiverem em outro lugar, edite a constante `PASTA_DADOS` no topo do script (seção "CONFIGURAÇÃO DE CAMINHOS").

## 3. Estrutura do código

O script é organizado em 6 etapas sequenciais, cada uma com suas próprias funções, mais uma função `main()` que orquestra tudo:

```
1. Raio-X inicial       -> raio_x_inicial()
2. Limpeza contratos    -> limpar_contratos()
3. Limpeza apostas      -> limpar_apostas()
4. Join das bases       -> agregar_apostas_por_cpf() + join_contratos_apostas()
5. Preparo de variáveis -> preparar_variaveis_join()
6. Testes estatísticos  -> teste_qui_quadrado() + regressao_logistica_risco()
```

### 3.1. Funções utilitárias

| Função | O que faz |
|---|---|
| `parse_valor_monetario(x)` | Converte qualquer formato de valor monetário (`R$ 1.234,56`, `1.234,56`, `1234.56`) para `float`. Regra: se a string tem vírgula, assume formato BR (ponto = milhar); senão, assume ponto decimal (formato US). |
| `formatar_moeda_br(x)` | Formata um `float` de volta para o padrão brasileiro `R$ 1.234,56`. |
| `parse_data_multiformato(x, formatos)` | Tenta converter uma string de data testando, em ordem, uma lista de formatos (`%d/%m/%Y`, `%Y-%m-%d` etc.). Retorna `NaT` se nenhum formato bater. |
| `normalizar_identificador(x)` | Remove qualquer caractere não alfanumérico e converte para maiúsculas — usado para unificar os 3 formatos de CPF encontrados nas bases em uma chave única de 11 caracteres. |

### 3.2. Etapa 1 — Raio-X inicial

`raio_x_inicial(df, nome_base)` — função de diagnóstico, **não altera os dados**. Imprime shape, tipos de coluna, contagem de nulos por coluna e contagem de linhas 100% duplicadas. Retorna um dicionário com esses valores, útil para logging ou testes automatizados.

### 3.3. Etapa 2 — `limpar_contratos(caminho_bruto)`

Pipeline de limpeza da base de contratos. Passo a passo:

1. Remove linhas 100% duplicadas (todas as colunas iguais).
2. Normaliza `cpf` (remove separadores/espaços, uppercase).
3. Converte `valor_contratado`, `limite_aprovado`, `renda_declarada` para float e reformata em `R$ 1.234,56`.
4. Padroniza `taxa_juros_am` com vírgula decimal e 2 casas.
5. Unifica `dt_contratacao` para `DD/MM/AAAA`.
6. Normaliza categorias (`produto`, `canal_originacao`, `uf`, `sexo`, `status_contrato`, `over60_6m`) via mapas de grafia → categoria única.
7. Trata sentinelas como nulo explícito:
   - `score_bureau <= 0` → `NaN`
   - `idade <= 1` ou `idade > 100` → `NaN`

### 3.4. Etapa 3 — `limpar_apostas(caminho_bruto)`

Mesma lógica geral aplicada à base de transações de apostas:

1. Remove duplicatas exatas.
2. Normaliza `cpf` (mesma função da etapa 2 — garante chave compatível para o join).
3. Converte e reformata `valor_aposta` para `R$ 1.234,56`.
   > **Nota:** valores negativos (1.714 registros na base bruta) são preservados como estão nesta etapa. A causa (estorno? erro de captura?) não foi confirmada com a área de negócio, então a função não decide sozinha como tratá-los — isso é feito de forma isolada e documentada na etapa 5, apenas para viabilizar o cálculo estatístico.
4. Unifica `dt_transacao` (incluindo formato com timestamp) para `DD/MM/AAAA`.
5. Normaliza `modalidade` e `canal`.

### 3.5. Etapa 4 — Join

Como a base de apostas é transacional (várias linhas por CPF) e a de contratos também tem várias linhas por CPF (clientes com mais de um contrato), um join direto geraria um produto cartesiano sem sentido. A solução:

- **`agregar_apostas_por_cpf(apostas_limpo)`**: agrupa as transações por CPF e calcula 9 métricas (quantidade de transações, valor total/médio/máximo apostado, dias distintos, primeira/última aposta, modalidade/casa/canal preferidos via moda estatística).
- **`join_contratos_apostas(contratos_limpo, apostas_limpo)`**: faz um `LEFT JOIN` de `contratos_limpo` (base, preserva todas as linhas) com a agregação, por `cpf`. Cria a flag `possui_apostas` (`SIM`/`NAO`) e zera métricas numéricas para quem não tem apostas (mantendo campos de texto/data como nulos, para não confundir "não apostou" com "apostou zero").

### 3.6. Etapa 5 — `preparar_variaveis_join(base_join)`

Deriva variáveis auxiliares numéricas (sufixo `_num`, `_dt`, `_bin`) a partir das colunas formatadas em texto, sem sobrescrever as colunas originais. Inclui:

- `score_bureau_100`: score dividido por 100, para leitura mais intuitiva do coeficiente da regressão (efeito "a cada 100 pontos").
- `log_valor_apostado`: log(1 + valor apostado), com valores negativos neutralizados via `clip(lower=0)` **apenas para este cálculo** — não altera a base limpa.

### 3.7. Etapa 6 — Testes estatísticos

- **`teste_qui_quadrado(df, coluna_flag, coluna_alvo)`**: teste de independência (`scipy.stats.chi2_contingency`) entre uma variável binária e um indicador de inadimplência. Retorna χ², p-valor, graus de liberdade e V de Cramer (tamanho de efeito).
- **`regressao_logistica_risco(df)`**: ajusta 3 modelos logísticos (`statsmodels.formula.api.logit`):
  - `modelo_base`: `over30_3m ~ score_bureau` (referência)
  - `modelo_1`: `over30_3m ~ possui_apostas + score_bureau` (efeito controlado)
  - `modelo_2`: `over30_3m ~ possui_apostas + score_bureau + log_valor_apostado` (intensidade)

### 3.8. `main()`

Orquestra o pipeline de ponta a ponta: lê os brutos, roda o raio-X, limpa as duas bases, salva os CSVs limpos, faz o join, salva o CSV final, prepara variáveis e roda os testes estatísticos — imprimindo os resultados de cada etapa no console. Retorna um dicionário com todos os objetos intermediários (DataFrames e modelos ajustados), útil caso você queira importar o script e continuar a análise interativamente (ex.: no Jupyter ou no terminal interativo do VSCode).

## 4. Principais decisões de modelagem (e por quê)

| Decisão | Justificativa |
|---|---|
| Vírgula → formato BR na detecção de moeda | A base mistura `1.234,56` (BR) e `1234.56` (US); a presença de vírgula é o sinal mais confiável para diferenciar os dois. |
| CPF normalizado para 11 caracteres alfanuméricos maiúsculos | As duas bases usam 3 formatos de identificador diferentes; sem essa normalização, o join por CPF perderia a maior parte dos registros em comum. |
| Agregação por CPF antes do join | Evita produto cartesiano entre duas tabelas de granularidade "many" (múltiplos contratos × múltiplas apostas por cliente). |
| Sentinelas → `NaN`, não zero | Preserva a diferença entre "valor real zero" e "dado ausente/erro" (ex.: `idade = 0` não é um recém-nascido tomando crédito, é erro de sistema). |
| Valores negativos em `valor_aposta` mantidos na base limpa | Sem confirmação de negócio sobre o significado (estorno vs. erro), a decisão mais segura é não descartar ou reinterpretar o dado original — apenas neutralizá-lo pontualmente onde é matematicamente necessário (log). |

## 5. Dicionário de dados — colunas geradas no join

| Coluna | Tipo | Descrição |
|---|---|---|
| `possui_apostas` | texto (SIM/NAO) | Indica se o titular do contrato tem histórico de apostas na base cruzada |
| `qtd_transacoes_apostas` | inteiro | Número total de apostas registradas para o CPF |
| `valor_total_apostado` | texto (R$) | Soma de todas as apostas do CPF |
| `valor_medio_aposta` | texto (R$) | Valor médio por aposta |
| `valor_max_aposta` | texto (R$) | Maior aposta individual registrada |
| `qtd_dias_distintos_aposta` | inteiro | Número de dias distintos em que o CPF registrou pelo menos uma aposta |
| `dt_primeira_aposta` / `dt_ultima_aposta` | data (DD/MM/AAAA) | Janela de atividade de apostas do CPF |
| `modalidade_preferida` | texto | Modalidade mais frequente (moda) entre as apostas do CPF |
| `casa_aposta_preferida` | texto | Casa de apostas mais frequente |
| `canal_aposta_preferido` | texto | Canal (App/Site) mais frequente |

## 6. Limitações conhecidas

- Os 1.714 valores negativos em `valor_aposta` não têm causa raiz confirmada — recomenda-se validar com a área de negócio antes de qualquer uso desses registros fora do escopo estatístico deste pipeline.
- A moda (`modalidade_preferida`, `casa_aposta_preferida`, `canal_aposta_preferido`) usa o primeiro valor em caso de empate — não há critério de desempate adicional (ex.: mais recente).
- O pipeline assume que os arquivos de entrada seguem exatamente os nomes e o separador (`;`) observados nas bases originais do case; nomes ou separadores diferentes exigem ajuste manual nas constantes de configuração.
