"""
==============================================================================
PIPELINE — ANÁLISE DE RISCO DE CRÉDITO x COMPORTAMENTO DE APOSTAS
==============================================================================
Case: Analista de Soluções II

Objetivo
--------
Consolidar em um único script documentado todas as etapas realizadas na
análise:
    1. Raio-X inicial das bases brutas (estrutura, nulos, duplicatas)
    2. Limpeza e padronização para o formato brasileiro
    3. Join das bases de contratos e apostas por CPF
    4. Análise exploratória e geração de indicadores
    5. Testes estatísticos (qui-quadrado e regressão logística)

Entradas esperadas (arquivos brutos, separador ';', encoding UTF-8 com BOM):
    - contratos.csv
    - transacoes_apostas.csv
    Devem estar na mesma pasta do script, dentro de uma subpasta "dados/"
    (ver configuração de caminhos logo abaixo — ajuste se necessário).

Saídas geradas (salvas em "saida/", criada automaticamente):
    - contratos_limpo.csv
    - transacoes_apostas_limpo.csv
    - contratos_apostas_join.csv

Como rodar no VSCode
--------------------
    1. Crie um ambiente virtual (opcional, mas recomendado):
           python -m venv .venv
           .venv\\Scripts\\activate        (Windows)
           source .venv/bin/activate       (Mac/Linux)
    2. Instale as dependências:
           pip install pandas numpy scipy statsmodels
    3. Coloque contratos.csv e transacoes_apostas.csv na pasta "dados/"
       (ou ajuste PASTA_DADOS abaixo para apontar para o local correto).
    4. Rode o script (F5 no VSCode, ou pelo terminal):
           python pipeline_analise_credito_apostas.py

Dependências: pandas, numpy, scipy, statsmodels
==============================================================================
"""

import os
import re
import numpy as np
import pandas as pd
from scipy import stats
import statsmodels.formula.api as smf

pd.set_option('display.max_columns', 50)
pd.set_option('display.width', 200)

# ==============================================================================
# CONFIGURAÇÃO DE CAMINHOS — ajuste aqui se seus arquivos estiverem em outro
# lugar. Por padrão, o script assume a seguinte estrutura de pastas:
#
#   projeto/
#   ├── pipeline_analise_credito_apostas.py   <- este arquivo
#   ├── dados/
#   │   ├── contratos.csv
#   │   └── transacoes_apostas.csv
#   └── saida/                                 <- criada automaticamente
#       ├── contratos_limpo.csv
#       ├── transacoes_apostas_limpo.csv
#       └── contratos_apostas_join.csv
# ==============================================================================
PASTA_BASE = os.path.dirname(os.path.abspath(__file__))
PASTA_DADOS = os.path.join(PASTA_BASE, 'dados')
PASTA_SAIDA = os.path.join(PASTA_BASE, 'saida')
os.makedirs(PASTA_SAIDA, exist_ok=True)

CAMINHO_CONTRATOS_BRUTO = os.path.join(PASTA_DADOS, 'contratos.csv')
CAMINHO_APOSTAS_BRUTO   = os.path.join(PASTA_DADOS, 'transacoes_apostas.csv')

SAIDA_CONTRATOS_LIMPO = os.path.join(PASTA_SAIDA, 'contratos_limpo.csv')
SAIDA_APOSTAS_LIMPO   = os.path.join(PASTA_SAIDA, 'transacoes_apostas_limpo.csv')
SAIDA_JOIN            = os.path.join(PASTA_SAIDA, 'contratos_apostas_join.csv')


# ==============================================================================
# FUNÇÕES UTILITÁRIAS DE PADRONIZAÇÃO
# ==============================================================================

def parse_valor_monetario(x):
    """
    Converte qualquer formato de valor monetário encontrado nas bases brutas
    para float.

    Formatos de entrada observados:
        'R$ 1.234,56'  (moeda BR com símbolo)
        '1.234,56'     (BR sem símbolo: ponto = milhar, vírgula = decimal)
        '1234.56'      (US: ponto = decimal)

    Regra de decisão: se a string contém vírgula, assume-se formato BR
    (remove pontos de milhar, troca vírgula por ponto decimal). Caso
    contrário, assume-se que o ponto já é decimal.
    """
    if pd.isna(x):
        return np.nan
    s = str(x).strip().replace('R$', '').strip()
    if s == '' or s.lower() == 'nan':
        return np.nan
    if ',' in s:
        s = s.replace('.', '').replace(',', '.')
    try:
        return float(s)
    except ValueError:
        return np.nan


def formatar_moeda_br(x):
    """Formata um float para string monetária no padrão brasileiro: R$ 1.234,56"""
    if pd.isna(x):
        return np.nan
    s = f"{x:,.2f}"
    s = s.replace(',', '#').replace('.', ',').replace('#', '.')
    return f"R$ {s}"


def parse_data_multiformato(x, formatos):
    """
    Converte uma string de data testando, em ordem, uma lista de formatos
    possíveis. Retorna pd.NaT se nenhum formato for compatível.
    """
    x = str(x).strip()
    for fmt in formatos:
        try:
            return pd.to_datetime(x, format=fmt)
        except ValueError:
            continue
    return pd.NaT


def normalizar_identificador(x):
    """
    Remove qualquer caractere que não seja letra ou número, e converte
    para maiúsculas. Usado para padronizar o CPF (que na base aparece em
    3 formatos: com pontos, com traços, sem separador, e com espaços em
    branco acidentais) em uma chave única de 11 caracteres, permitindo o
    cruzamento (join) entre as bases de contratos e de apostas.
    """
    return re.sub(r'[^A-Za-z0-9]', '', str(x)).upper().strip()


# ==============================================================================
# ETAPA 1 — RAIO-X INICIAL (diagnóstico, sem alterar os dados)
# ==============================================================================

def raio_x_inicial(df, nome_base):
    """
    Imprime um diagnóstico rápido de qualidade de dados:
    estrutura, tipos, nulos e duplicatas. Não modifica o DataFrame.
    """
    print(f'\n{"="*70}\nRAIO-X — {nome_base}\n{"="*70}')
    print(f'Shape: {df.shape}')
    print(f'\nTipos de dados:\n{df.dtypes}')
    print(f'\nNulos por coluna:\n{df.isnull().sum()}')
    print(f'\nLinhas 100% duplicadas: {df.duplicated().sum()}')
    return {
        'shape': df.shape,
        'nulos': df.isnull().sum().to_dict(),
        'duplicatas': int(df.duplicated().sum()),
    }


# ==============================================================================
# ETAPA 2 — LIMPEZA: CONTRATOS.CSV
# ==============================================================================

def limpar_contratos(caminho_bruto):
    """
    Pipeline de limpeza da base de contratos.

    Tratamentos aplicados:
        - Remoção de linhas 100% duplicadas.
        - CPF: remoção de espaços/separadores, padronização em maiúsculas
          (chave de 11 caracteres, compatível com a base de apostas).
        - Datas: unificação de 3 formatos (DD/MM/AAAA, DD-MM-AAAA,
          AAAA-MM-DD) para o padrão brasileiro DD/MM/AAAA.
        - Valores monetários (valor_contratado, limite_aprovado,
          renda_declarada): unificação de formatos para R$ 1.234,56.
        - Taxa de juros: padronização com vírgula decimal.
        - Categorias (produto, canal_originacao, status_contrato,
          over60_6m): normalização de grafias (maiúsculas/minúsculas
          inconsistentes) para um único rótulo por categoria.
        - Sentinelas tratados como nulo explícito:
            score_bureau <= 0        -> NaN (sem informação de bureau)
            idade <= 1 ou > 100      -> NaN (erro de digitação/sistema;
                                        idade=1 foi identificado em uma
                                        segunda passada de QA)
    """
    df = pd.read_csv(caminho_bruto, sep=';', encoding='utf-8-sig')
    n_original = len(df)

    cols_originais = df.columns.tolist()
    n_dup = df.duplicated(subset=cols_originais).sum()
    df = df.drop_duplicates(subset=cols_originais).reset_index(drop=True)

    # CPF
    df['cpf'] = df['cpf'].apply(normalizar_identificador)

    # Valores monetários
    for col in ['valor_contratado', 'limite_aprovado', 'renda_declarada']:
        valores = df[col].apply(parse_valor_monetario)
        df[col] = valores.apply(formatar_moeda_br)

    # Taxa de juros (garante vírgula decimal com 2 casas)
    def fmt_taxa(x):
        if pd.isna(x):
            return np.nan
        v = float(str(x).replace(',', '.'))
        return f"{v:.2f}".replace('.', ',')
    df['taxa_juros_am'] = df['taxa_juros_am'].apply(fmt_taxa)

    # Datas
    formatos_data = ('%d/%m/%Y', '%d-%m-%Y', '%Y-%m-%d')
    df['dt_contratacao'] = (
        df['dt_contratacao']
        .apply(lambda x: parse_data_multiformato(x, formatos_data))
        .dt.strftime('%d/%m/%Y')
    )

    # Categorias
    mapa_produto = {
        'EP': 'Empréstimo Pessoal', 'EMPRESTIMO PESSOAL': 'Empréstimo Pessoal',
        'EMPRÉSTIMO PESSOAL': 'Empréstimo Pessoal',
        'CREDIARIO': 'Crediário', 'CREDIÁRIO': 'Crediário',
        'CARTAO': 'Cartão', 'CARTÃO': 'Cartão',
        'CDC': 'CDC',
    }
    df['produto'] = df['produto'].str.upper().str.strip().map(mapa_produto)

    mapa_canal = {'APP': 'App', 'SITE': 'Site', 'LOJA': 'Loja', 'PARCEIRO': 'Parceiro'}
    df['canal_originacao'] = df['canal_originacao'].str.upper().str.strip().map(mapa_canal)

    df['uf'] = df['uf'].str.upper().str.strip()
    df['sexo'] = df['sexo'].str.upper().str.strip()
    df['status_contrato'] = df['status_contrato'].str.strip().str.capitalize()
    df['over60_6m'] = df['over60_6m'].str.upper().str.strip()

    # Sentinelas -> nulo explícito
    df['score_bureau'] = df['score_bureau'].apply(
        lambda v: np.nan if pd.notna(v) and v <= 0 else v
    ).astype('Int64')

    df['idade'] = df['idade'].apply(
        lambda v: np.nan if pd.notna(v) and (v <= 1 or v > 100) else v
    ).astype('Int64')

    print(f'[contratos] originais={n_original} | duplicatas_removidas={n_dup} | finais={len(df)}')
    return df


# ==============================================================================
# ETAPA 3 — LIMPEZA: TRANSACOES_APOSTAS.CSV
# ==============================================================================

def limpar_apostas(caminho_bruto):
    """
    Pipeline de limpeza da base de transações de apostas.

    Tratamentos aplicados:
        - Remoção de linhas 100% duplicadas.
        - CPF: mesma normalização usada em contratos (3 formatos de
          entrada -> chave única de 11 caracteres), permitindo o join.
        - Datas: unificação de 4 formatos (incluindo timestamp completo
          AAAA-MM-DD HH:MM:SS) para DD/MM/AAAA.
        - valor_aposta: unificação de formatos para R$ 1.234,56.
          OBS: foram identificados 1.714 valores negativos na base bruta
          (ex.: 'R$ -44,23'), preservados como estão nesta etapa — a
          decisão de tratamento (estorno vs. erro de captura) depende de
          confirmação da área de negócio e é tratada à parte na análise
          estatística (ver `preparar_variaveis_join`).
        - Categorias (modalidade, canal): normalização de grafias.
    """
    df = pd.read_csv(caminho_bruto, sep=';', encoding='utf-8-sig')
    n_original = len(df)

    cols_originais = df.columns.tolist()
    n_dup = df.duplicated(subset=cols_originais).sum()
    df = df.drop_duplicates(subset=cols_originais).reset_index(drop=True)

    df['cpf'] = df['cpf'].apply(normalizar_identificador)

    valores = df['valor_aposta'].apply(parse_valor_monetario)
    df['valor_aposta'] = valores.apply(formatar_moeda_br)

    formatos_data = ('%Y-%m-%d %H:%M:%S', '%d/%m/%Y', '%d-%m-%Y', '%Y-%m-%d')
    df['dt_transacao'] = (
        df['dt_transacao']
        .apply(lambda x: parse_data_multiformato(x, formatos_data))
        .dt.strftime('%d/%m/%Y')
    )

    df['modalidade'] = df['modalidade'].str.strip().str.capitalize()
    df['canal'] = df['canal'].str.strip().str.capitalize()
    df['casa_aposta'] = df['casa_aposta'].str.strip()

    print(f'[apostas] originais={n_original} | duplicatas_removidas={n_dup} | finais={len(df)}')
    return df[['cpf', 'dt_transacao', 'valor_aposta', 'modalidade', 'casa_aposta', 'canal']]


# ==============================================================================
# ETAPA 4 — JOIN: CONTRATOS (nível contrato) <- APOSTAS (agregadas por CPF)
# ==============================================================================

def agregar_apostas_por_cpf(apostas_limpo):
    """
    Agrega a base de transações (granularidade: 1 linha por aposta) para
    granularidade de 1 linha por CPF, calculando métricas de volume,
    intensidade e preferência de uso.

    Por que agregar antes do join: a base de contratos também tem
    múltiplas linhas por CPF (um cliente pode ter vários contratos).
    Um join direto linha-a-linha entre duas bases "many" geraria um
    produto cartesiano sem sentido de negócio.
    """
    def moda(serie):
        return serie.mode().iloc[0] if not serie.mode().empty else np.nan

    df = apostas_limpo.copy()
    df['valor_aposta_num'] = df['valor_aposta'].apply(parse_valor_monetario)
    df['dt_transacao_dt'] = pd.to_datetime(df['dt_transacao'], format='%d/%m/%Y')

    agg = df.groupby('cpf').agg(
        qtd_transacoes_apostas=('valor_aposta_num', 'count'),
        valor_total_apostado=('valor_aposta_num', 'sum'),
        valor_medio_aposta=('valor_aposta_num', 'mean'),
        valor_max_aposta=('valor_aposta_num', 'max'),
        qtd_dias_distintos_aposta=('dt_transacao_dt', 'nunique'),
        dt_primeira_aposta=('dt_transacao_dt', 'min'),
        dt_ultima_aposta=('dt_transacao_dt', 'max'),
        modalidade_preferida=('modalidade', moda),
        casa_aposta_preferida=('casa_aposta', moda),
        canal_aposta_preferido=('canal', moda),
    ).reset_index()

    agg['valor_medio_aposta'] = agg['valor_medio_aposta'].round(2)
    agg['dt_primeira_aposta'] = agg['dt_primeira_aposta'].dt.strftime('%d/%m/%Y')
    agg['dt_ultima_aposta'] = agg['dt_ultima_aposta'].dt.strftime('%d/%m/%Y')

    for col in ['valor_total_apostado', 'valor_medio_aposta', 'valor_max_aposta']:
        agg[col] = agg[col].apply(formatar_moeda_br)

    return agg


def join_contratos_apostas(contratos_limpo, apostas_limpo):
    """
    LEFT JOIN de contratos_limpo (base, preserva todas as linhas) com a
    agregação de apostas por CPF. Cria a flag `possui_apostas` (SIM/NAO)
    e zera métricas numéricas para quem não tem histórico de apostas.
    """
    agg_apostas = agregar_apostas_por_cpf(apostas_limpo)
    base = contratos_limpo.merge(agg_apostas, on='cpf', how='left')

    base['possui_apostas'] = np.where(base['qtd_transacoes_apostas'].notna(), 'SIM', 'NAO')
    base['qtd_transacoes_apostas'] = base['qtd_transacoes_apostas'].fillna(0).astype(int)
    base['qtd_dias_distintos_aposta'] = base['qtd_dias_distintos_aposta'].fillna(0).astype(int)

    print(f'[join] contratos={len(contratos_limpo)} | cpfs_em_comum='
          f'{len(set(contratos_limpo["cpf"]) & set(apostas_limpo["cpf"]))} | '
          f'linhas_finais={len(base)}')
    return base


# ==============================================================================
# ETAPA 5 — PREPARO DE VARIÁVEIS PARA ANÁLISE / MODELAGEM
# ==============================================================================

def preparar_variaveis_join(base_join):
    """
    Deriva variáveis numéricas a partir das colunas formatadas em texto
    (R$ e datas) para uso em estatística e modelagem. Não sobrescreve as
    colunas originais formatadas — cria colunas auxiliares com sufixo
    '_num' ou '_dt'.

    Tratamento aplicado aqui (e não na limpeza): valores de
    `valor_total_apostado` negativos (herdados dos 1.714 registros de
    `valor_aposta` negativos na base bruta) são zerados (`clip(lower=0)`)
    apenas para o cálculo de log, evitando erro matemático. A causa raiz
    (valores negativos na base bruta) deve ser esclarecida com a área de
    negócio antes de uma correção definitiva na base limpa.
    """
    df = base_join.copy()
    df['valor_contratado_num'] = df['valor_contratado'].apply(parse_valor_monetario)
    df['limite_aprovado_num'] = df['limite_aprovado'].apply(parse_valor_monetario)
    df['renda_declarada_num'] = df['renda_declarada'].apply(parse_valor_monetario)
    df['valor_total_apostado_num'] = df['valor_total_apostado'].apply(parse_valor_monetario)
    df['dt_contratacao_dt'] = pd.to_datetime(df['dt_contratacao'], format='%d/%m/%Y')
    df['ano_mes'] = df['dt_contratacao_dt'].dt.to_period('M')

    df['possui_apostas_bin'] = (df['possui_apostas'] == 'SIM').astype(int)
    df['score_bureau_100'] = df['score_bureau'] / 100
    df['valor_apostado_clip'] = df['valor_total_apostado_num'].fillna(0).clip(lower=0)
    df['log_valor_apostado'] = np.log1p(df['valor_apostado_clip'])
    return df


# ==============================================================================
# ETAPA 6 — TESTES ESTATÍSTICOS
# ==============================================================================

def teste_qui_quadrado(df, coluna_flag, coluna_alvo):
    """
    Teste qui-quadrado de independência entre uma variável categórica
    binária (ex.: possui_apostas) e um indicador de inadimplência
    (ex.: over30_3m). Retorna estatística, p-valor e V de Cramer
    (tamanho de efeito).
    """
    tab = pd.crosstab(df[coluna_flag], df[coluna_alvo])
    chi2, p, dof, _ = stats.chi2_contingency(tab)
    n = tab.sum().sum()
    cramers_v = np.sqrt(chi2 / (n * (min(tab.shape) - 1)))
    return {'chi2': chi2, 'p_valor': p, 'graus_liberdade': dof, 'cramers_v': cramers_v, 'tabela': tab}


def regressao_logistica_risco(df):
    """
    Ajusta 3 modelos logísticos para over30_3m:
        modelo_base   : ~ score_bureau                       (referência)
        modelo_1      : ~ possui_apostas + score_bureau       (efeito controlado)
        modelo_2      : ~ possui_apostas + score_bureau + log(valor apostado)

    Retorna os três modelos ajustados (objetos statsmodels) para
    inspeção de coeficientes, odds ratios e comparação de verossimilhança.
    """
    d = df.dropna(subset=['score_bureau', 'over30_3m', 'possui_apostas_bin']).copy()

    modelo_base = smf.logit('over30_3m ~ score_bureau_100', data=d).fit(disp=0)
    modelo_1 = smf.logit('over30_3m ~ possui_apostas_bin + score_bureau_100', data=d).fit(disp=0)
    modelo_2 = smf.logit(
        'over30_3m ~ possui_apostas_bin + score_bureau_100 + log_valor_apostado',
        data=d
    ).fit(disp=0)

    return {'base': modelo_base, 'com_apostas': modelo_1, 'com_intensidade': modelo_2, 'n': len(d)}


# ==============================================================================
# EXECUÇÃO DO PIPELINE COMPLETO
# ==============================================================================

def main():
    # --- 0. Checagem amigável de arquivos de entrada ---
    for caminho in (CAMINHO_CONTRATOS_BRUTO, CAMINHO_APOSTAS_BRUTO):
        if not os.path.exists(caminho):
            raise FileNotFoundError(
                f'Arquivo não encontrado: {caminho}\n'
                f'Coloque contratos.csv e transacoes_apostas.csv dentro da pasta '
                f'"{PASTA_DADOS}", ou ajuste PASTA_DADOS no topo do script.'
            )

    # --- 1. Raio-X das bases brutas ---
    contratos_bruto = pd.read_csv(CAMINHO_CONTRATOS_BRUTO, sep=';', encoding='utf-8-sig')
    apostas_bruto = pd.read_csv(CAMINHO_APOSTAS_BRUTO, sep=';', encoding='utf-8-sig')
    raio_x_inicial(contratos_bruto, 'contratos.csv (bruto)')
    raio_x_inicial(apostas_bruto, 'transacoes_apostas.csv (bruto)')

    # --- 2 e 3. Limpeza ---
    contratos_limpo = limpar_contratos(CAMINHO_CONTRATOS_BRUTO)
    apostas_limpo = limpar_apostas(CAMINHO_APOSTAS_BRUTO)
    contratos_limpo.to_csv(SAIDA_CONTRATOS_LIMPO, sep=';', index=False, encoding='utf-8-sig')
    apostas_limpo.to_csv(SAIDA_APOSTAS_LIMPO, sep=';', index=False, encoding='utf-8-sig')

    # --- 4. Join ---
    base_join = join_contratos_apostas(contratos_limpo, apostas_limpo)
    base_join.to_csv(SAIDA_JOIN, sep=';', index=False, encoding='utf-8-sig')

    # --- 5 e 6. Preparo de variáveis e testes estatísticos ---
    df_analise = preparar_variaveis_join(base_join)

    qui2 = teste_qui_quadrado(df_analise, 'possui_apostas', 'over30_3m')
    print(f"\nQui-quadrado possui_apostas x over30_3m: "
          f"chi2={qui2['chi2']:.2f} | p={qui2['p_valor']:.2e} | V de Cramer={qui2['cramers_v']:.4f}")

    modelos = regressao_logistica_risco(df_analise)
    print(f"\nRegressão logística (n={modelos['n']}):")
    print(modelos['com_apostas'].summary())

    return {
        'contratos_limpo': contratos_limpo,
        'apostas_limpo': apostas_limpo,
        'base_join': df_analise,
        'qui_quadrado': qui2,
        'modelos': modelos,
    }


if __name__ == '__main__':
    resultado = main()
