# ================================================================
# 0. Gerar todas as imagens de gráficos para o relatório do Word.
# ================================================================

import matplotlib.pyplot as plt
import matplotlib.ticker as mticker
import os
from pathlib import Path
import numpy as np
import pandas as pd
import matplotlib

matplotlib.use('Agg')

ROOT_DIR = Path(__file__).resolve().parent
GRAFICOS_DIR = ROOT_DIR / 'graficos'
GRAFICOS_DIR.mkdir(parents=True, exist_ok=True)

plt.rcParams['font.family'] = 'DejaVu Sans'
plt.rcParams['axes.spines.top'] = False
plt.rcParams['axes.spines.right'] = False
plt.rcParams['axes.grid'] = True
plt.rcParams['grid.color'] = '#e1e0d9'
plt.rcParams['grid.linewidth'] = 0.6
plt.rcParams['axes.axisbelow'] = True

COLOR_RED = '#c0392b'
COLOR_BLUE = '#2a6fb0'
COLOR_GRAY = '#7f7f7f'

csv_candidates = [
    ROOT_DIR / 'contratos_apostas_join.csv',
    ROOT_DIR / 'pipeline_python' / 'pipeline_python' / 'contratos_apostas_join.csv',
]
csv_path = next((p for p in csv_candidates if p.exists()), csv_candidates[0])

df = pd.read_csv(csv_path, sep=';', encoding='utf-8-sig')


def parse_moeda(x):
    if pd.isna(x):
        return np.nan
    s = str(x).replace('R$', '').strip().replace('.', '').replace(',', '.')
    return float(s)


df['valor_contratado_num'] = df['valor_contratado'].apply(parse_moeda)
df['valor_total_apostado_num'] = df['valor_total_apostado'].apply(parse_moeda)
df['dt_contratacao_dt'] = pd.to_datetime(
    df['dt_contratacao'], format='%d/%m/%Y')
df['possui_apostas_bin'] = (df['possui_apostas'] == 'SIM').astype(int)

# ============================================================
# 1. Inadimplencia por faixa de score
# ============================================================
valid = df[df['score_bureau'] > 0].copy()
valid['score_band'] = pd.cut(valid['score_bureau'], bins=[0, 400, 500, 600, 700, 800, 900],
                             labels=['<=400', '401-500', '501-600', '601-700', '701-800', '801-900'])
r1 = valid.groupby('score_band')['over30_3m'].mean()*100

fig, ax = plt.subplots(figsize=(7, 4))
bars = ax.bar(r1.index.astype(str), r1.values, color=COLOR_RED, width=0.6)
ax.set_ylabel('Taxa over30_3m (%)')
ax.set_xlabel('Faixa de score de bureau')
ax.set_title('Inadimplência por faixa de score de bureau')
ax.set_ylim(0, 100)
for b, v in zip(bars, r1.values):
    ax.text(b.get_x()+b.get_width()/2, v+1.5,
            f'{v:.1f}%', ha='center', fontsize=9)
plt.tight_layout()
plt.savefig(GRAFICOS_DIR / '01_score_band.png', dpi=150)
plt.close()

# ============================================================
# 2. Evolucao da inadimplencia por safra mensal
# ============================================================
df['ano_mes'] = df['dt_contratacao_dt'].dt.to_period('M')
safra = df.groupby('ano_mes')['over30_3m'].mean()*100
labels = [str(p) for p in safra.index]
labels = ['Jun/25', 'Jul/25', 'Ago/25',
          'Set/25', 'Out/25', 'Nov/25', 'Dez/25*']

fig, ax = plt.subplots(figsize=(7, 4))
ax.plot(labels, safra.values, marker='o', color=COLOR_RED, linewidth=2)
ax.fill_between(labels, safra.values, alpha=0.08, color=COLOR_RED)
ax.set_ylabel('Taxa over30_3m (%)')
ax.set_title('Evolução da inadimplência por safra (mês de contratação)')
ax.set_ylim(10, 22)
for x, v in zip(labels, safra.values):
    ax.text(x, v+0.4, f'{v:.1f}%', ha='center', fontsize=9)
plt.tight_layout()
plt.savefig(GRAFICOS_DIR / '02_safra_trend.png', dpi=150)
plt.close()

# ============================================================
# 3. Distribuicao do valor contratado (histograma)
# ============================================================
fig, ax = plt.subplots(figsize=(7, 4))
ax.hist(df['valor_contratado_num'].dropna(),
        bins=30, color=COLOR_BLUE, edgecolor='white')
ax.set_xlabel('Valor contratado (R$)')
ax.set_ylabel('Nº de contratos')
ax.set_title('Distribuição do valor contratado')
plt.tight_layout()
plt.savefig(GRAFICOS_DIR / '03_hist_valor.png', dpi=150)
plt.close()

# ============================================================
# 4. Inadimplencia: apostadores vs nao apostadores
# ============================================================
r4 = df.groupby('possui_apostas')['over30_3m'].mean()*100
fig, ax = plt.subplots(figsize=(7, 3.2))
bars = ax.barh(['Sem histórico de apostas', 'Com histórico de apostas'],
               [r4['NAO'], r4['SIM']], color=[COLOR_BLUE, COLOR_RED], height=0.5)
ax.set_xlabel('Taxa over30_3m (%)')
ax.set_title('Inadimplência: apostadores vs não apostadores')
ax.set_xlim(0, 30)
for b, v in zip(bars, [r4['NAO'], r4['SIM']]):
    ax.text(v+0.5, b.get_y()+b.get_height()/2,
            f'{v:.1f}%', va='center', fontsize=10)
plt.tight_layout()
plt.savefig(GRAFICOS_DIR / '04_apostas_vs_nao.png', dpi=150)
plt.close()

# ============================================================
# 5. Dose-resposta: intensidade de apostas x inadimplencia
# ============================================================
ap = df[df['possui_apostas'] == 'SIM'].copy()
ap['fx_qtd'] = pd.cut(ap['qtd_transacoes_apostas'], bins=[0, 5, 10, 20, 50, 10000],
                      labels=['1-5', '6-10', '11-20', '21-50', '50+'])
r5 = ap.groupby('fx_qtd')['over30_3m'].mean()*100

fig, ax = plt.subplots(figsize=(7, 4))
ax.plot(r5.index.astype(str), r5.values,
        marker='o', color=COLOR_RED, linewidth=2)
ax.fill_between(range(len(r5)), r5.values, alpha=0.08, color=COLOR_RED)
ax.set_xlabel('Nº de transações de apostas no período')
ax.set_ylabel('Taxa over30_3m (%)')
ax.set_title('Efeito dose-resposta: intensidade de apostas x inadimplência')
ax.set_ylim(0, 40)
for i, v in enumerate(r5.values):
    ax.text(i, v+1, f'{v:.1f}%', ha='center', fontsize=9)
plt.tight_layout()
plt.savefig(GRAFICOS_DIR / '05_dose_resposta.png', dpi=150)
plt.close()

# ============================================================
# 6. Efeito de apostas dentro de cada faixa de score
# ============================================================
valid['score_band2'] = pd.cut(valid['score_bureau'], bins=[0, 500, 600, 700, 800, 900],
                              labels=['<=500', '501-600', '601-700', '701-800', '801-900'])
piv = valid.groupby(['score_band2', 'possui_apostas'])[
    'over30_3m'].mean().unstack()*100

fig, ax = plt.subplots(figsize=(7.5, 4.2))
x = np.arange(len(piv.index))
width = 0.35
ax.bar(x-width/2, piv['NAO'], width, label='Sem apostas', color=COLOR_BLUE)
ax.bar(x+width/2, piv['SIM'], width, label='Com apostas', color=COLOR_RED)
ax.set_xticks(x)
ax.set_xticklabels(piv.index.astype(str))
ax.set_xlabel('Faixa de score de bureau')
ax.set_ylabel('Taxa over30_3m (%)')
ax.set_title('Efeito de apostas dentro de cada faixa de score')
ax.legend(frameon=False)
plt.tight_layout()
plt.savefig(GRAFICOS_DIR / '06_score_x_apostas.png', dpi=150)
plt.close()

# ============================================================
# 7. Evolucao da fatia de apostadores na carteira
# ============================================================
r7 = df.groupby('ano_mes')['possui_apostas_bin'].mean()*100
fig, ax = plt.subplots(figsize=(7, 4))
ax.plot(labels, r7.values, marker='o', color=COLOR_RED, linewidth=2)
ax.fill_between(labels, r7.values, alpha=0.08, color=COLOR_RED)
ax.set_ylabel('% de contratos com titular apostador')
ax.set_title('Evolução da fatia de apostadores na carteira')
ax.set_ylim(0, 55)
for x_, v in zip(labels, r7.values):
    ax.text(x_, v+1.5, f'{v:.1f}%', ha='center', fontsize=9)
plt.tight_layout()
plt.savefig(GRAFICOS_DIR / '07_fatia_apostadores.png', dpi=150)
plt.close()

print('Graficos gerados com sucesso.')
print(sorted(p.name for p in GRAFICOS_DIR.iterdir()))
