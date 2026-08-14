const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell,
  WidthType, ShadingType, BorderStyle, AlignmentType, ImageRun, PageBreak,
  Header, Footer, PageNumber, LevelFormat
} = require("docx");

const NAVY = "1F3864";
const RED = "C0392B";
const GRAY = "595959";
const LIGHTGRAY = "F2F2F2";

function h1(text) {
  return new Paragraph({ text, heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 } });
}
function h2(text) {
  return new Paragraph({ text, heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 150 } });
}
function p(text, opts = {}) {
  return new Paragraph({
    spacing: { after: 160, line: 276 },
    children: [new TextRun({ text, size: 22, ...opts })],
  });
}
function bullet(text, opts = {}) {
  return new Paragraph({
    numbering: { reference: "bullets", level: 0 },
    spacing: { after: 80 },
    children: [new TextRun({ text, size: 22, ...opts })],
  });
}
function caption(text) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 300 },
    children: [new TextRun({ text, size: 18, italics: true, color: GRAY })],
  });
}

function img(path, widthPx) {
  const data = fs.readFileSync(path);
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 100, after: 60 },
    children: [
      new ImageRun({
        type: "png",
        data,
        transformation: { width: widthPx, height: Math.round(widthPx * 0.57) },
      }),
    ],
  });
}

function cell(text, opts = {}) {
  const { bold = false, shade = null, width = null, color = "000000", align = AlignmentType.LEFT } = opts;
  return new TableCell({
    width: width ? { size: width, type: WidthType.DXA } : undefined,
    shading: shade ? { type: ShadingType.CLEAR, fill: shade } : undefined,
    margins: { top: 80, bottom: 80, left: 100, right: 100 },
    children: [new Paragraph({
      alignment: align,
      children: [new TextRun({ text: String(text), bold, size: 20, color })],
    })],
  });
}

function table(headers, rows, colWidths) {
  const totalWidth = colWidths.reduce((a, b) => a + b, 0);
  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map((hText, i) => cell(hText, { bold: true, shade: NAVY, color: "FFFFFF", width: colWidths[i] })),
  });
  const bodyRows = rows.map((r, idx) => new TableRow({
    children: r.map((val, i) => cell(val, { width: colWidths[i], shade: idx % 2 === 1 ? LIGHTGRAY : null })),
  }));
  return new Table({
    width: { size: totalWidth, type: WidthType.DXA },
    columnWidths: colWidths,
    rows: [headerRow, ...bodyRows],
    borders: {
      top: { style: BorderStyle.SINGLE, size: 2, color: "BFBFBF" },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: "BFBFBF" },
      left: { style: BorderStyle.SINGLE, size: 2, color: "BFBFBF" },
      right: { style: BorderStyle.SINGLE, size: 2, color: "BFBFBF" },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: "D9D9D9" },
      insideVertical: { style: BorderStyle.SINGLE, size: 2, color: "D9D9D9" },
    },
  });
}

const IMG_DIR = "/home/claude/imgs";

const doc = new Document({
  numbering: {
    config: [{
      reference: "bullets",
      levels: [{ level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 360, hanging: 260 } } } }],
    }],
  },
  styles: {
    default: {
      document: { run: { font: "Calibri", size: 22 } },
    },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal",
        run: { size: 32, bold: true, color: NAVY, font: "Calibri" },
        paragraph: { spacing: { before: 400, after: 200 }, border: { bottom: { color: NAVY, space: 4, style: BorderStyle.SINGLE, size: 8 } } } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal",
        run: { size: 26, bold: true, color: NAVY, font: "Calibri" },
        paragraph: { spacing: { before: 300, after: 150 } } },
    ],
  },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 1080, bottom: 1080, left: 1080, right: 1080 },
      },
    },
    headers: {
      default: new Header({
        children: [new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [new TextRun({ text: "Análise de Risco de Crédito × Comportamento de Apostas", size: 16, color: GRAY })],
        })],
      }),
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: "Página ", size: 16, color: GRAY }),
            new TextRun({ children: [PageNumber.CURRENT], size: 16, color: GRAY }),
            new TextRun({ text: " de ", size: 16, color: GRAY }),
            new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: GRAY }),
          ],
        })],
      }),
    },
    children: [
      new Paragraph({ spacing: { before: 2000 }, children: [] }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: "Relatório de Análise", bold: true, size: 56, color: NAVY })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
        children: [new TextRun({ text: "Risco de Crédito × Comportamento de Apostas", bold: true, size: 36, color: RED })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 800 },
        children: [new TextRun({ text: "Case — Analista de Soluções II", size: 24, color: GRAY })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 100 },
        children: [new TextRun({ text: "Bases utilizadas: contratos.csv · transacoes_apostas.csv", size: 20, color: GRAY })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 100 },
        children: [new TextRun({ text: "Agosto de 2026", size: 20, color: GRAY })],
      }),
      new Paragraph({ children: [new PageBreak()] }),

      h1("Sumário executivo"),
      p("Este relatório consolida a análise de duas bases — contratos de crédito (contratos.csv) e transações de apostas online (transacoes_apostas.csv) — cobrindo diagnóstico de qualidade de dados, limpeza e padronização, cruzamento das bases por CPF, análise exploratória e testes estatísticos de significância."),
      p("Achado central: clientes com histórico de apostas apresentam inadimplência (over30_3m) de 23,3%, contra 15,0% para quem não aposta — uma diferença estatisticamente significante (qui-quadrado, p < 0,001) que se mantém mesmo controlando pelo score de bureau (odds ratio = 1,43; regressão logística, p < 0,001). O efeito é dose-resposta: quanto mais intenso o uso (frequência e valor apostado), maior o risco, e a fatia de apostadores na carteira mais que dobrou entre junho e dezembro de 2025 (19,4% → 46,7%), coincidindo com uma piora simultânea da inadimplência por safra."),
      p("Principais recomendações: (1) investigar a mudança de mix de carteira como driver da piora de safra; (2) revisar a combinação de maior risco identificada (Crediário via Loja); (3) considerar o uso de sinal de apostas como variável complementar de risco/pricing, sujeito a avaliação jurídica e de compliance (LGPD); (4) adotar corte de crédito combinado (intensidade de apostas + score baixo) em vez de corte binário, por ser ~4x mais eficiente na relação risco reduzido / produção sacrificada."),

      new Paragraph({ children: [new PageBreak()] }),

      h1("1. Contexto e objetivo"),
      p("O case parte de duas bases brutas fornecidas em formato CSV, com inconsistências típicas de integração de sistemas distintos: formatos de data, valores monetários e identificadores misturados, categorias com grafias divergentes, e sentinelas de erro não sinalizados como nulo. O objetivo foi (i) diagnosticar e sanar essas inconsistências, (ii) cruzar as duas bases para investigar se o comportamento de apostas do titular de um contrato está associado ao risco de inadimplência, e (iii) validar estatisticamente essa associação, controlando pela variável de risco mais forte disponível: o score de bureau."),

      h1("2. Raio-X inicial das bases brutas"),
      h2("2.1. contratos.csv"),
      table(
        ["Métrica", "Valor"],
        [
          ["Registros", "52.129"],
          ["Colunas", "18"],
          ["Linhas 100% duplicadas", "310"],
          ["Nulos — score_bureau", "266 (0,51%)"],
          ["Nulos — renda_declarada", "2.552 (4,90%) — visíveis; havia nulos disfarçados de texto"],
          ["Nulos — idade", "477 (0,92%)"],
          ["Formatos de data coexistindo", "3 (DD/MM/AAAA, DD-MM-AAAA, AAAA-MM-DD)"],
          ["Formatos monetários coexistindo", "3 (R$ 1.234,56 / 1.234,56 / 1234.56)"],
          ["Grafias de produto", "10 grafias para 4 categorias reais"],
          ["Grafias de canal_originacao", "12 grafias para 4 categorias reais"],
        ],
        [5000, 4500]
      ),
      caption("Tabela 1 — Diagnóstico inicial de contratos.csv"),

      h2("2.2. transacoes_apostas.csv"),
      table(
        ["Métrica", "Valor"],
        [
          ["Registros", "122.173"],
          ["Colunas", "6"],
          ["Linhas 100% duplicadas", "1.209"],
          ["Nulos visíveis", "0 em todas as colunas"],
          ["Formatos de data coexistindo", "4 (incluindo timestamp completo)"],
          ["Formatos monetários coexistindo", "3"],
          ["Formatos de CPF coexistindo", "3 (11 sem separador / com pontos / com traços, maiúsc.)"],
          ["Grafias de modalidade", "12 grafias para 4 categorias reais"],
          ["Grafias de canal", "4 grafias para 2 categorias reais"],
          ["casa_aposta", "Já estava consistente (8 operadoras, sem variação)"],
        ],
        [5000, 4500]
      ),
      caption("Tabela 2 — Diagnóstico inicial de transacoes_apostas.csv"),

      new Paragraph({ children: [new PageBreak()] }),

      h1("3. Limpeza e padronização"),
      p("Todas as colunas textuais, monetárias e de data foram padronizadas para o formato brasileiro. A tabela 3 resume as transformações aplicadas."),
      table(
        ["Campo", "Antes", "Depois"],
        [
          ["Datas", "3–4 formatos misturados", "DD/MM/AAAA"],
          ["Valores monetários", "R$ 1.234,56 / 1.234,56 / 1234.56", "R$ 1.234,56"],
          ["produto", "10 grafias", "4 categorias padronizadas"],
          ["canal_originacao / canal", "12 / 4 grafias", "4 / 2 categorias padronizadas"],
          ["status_contrato", "Capitalização inconsistente", "Ativo / Cancelado / Quitado"],
          ["cpf", "3 formatos + espaços em branco", "11 caracteres alfanuméricos, maiúsculos"],
        ],
        [2800, 3400, 3300]
      ),
      caption("Tabela 3 — Padronizações aplicadas em ambas as bases"),

      h2("3.1. Tratamento de sentinelas e inconsistências"),
      p("Durante o processo de limpeza e nas revisões subsequentes, foram identificados e tratados os seguintes valores inválidos, convertidos em nulo explícito ou corrigidos:"),
      bullet("score_bureau = -1 (264 registros): sentinela de \"sem informação de bureau\", tratado como nulo."),
      bullet("idade = 199 (167 registros) e idade = 0 (161 registros): erro de digitação/sistema, tratados como nulo."),
      bullet("idade = 1 (145 registros): identificado em uma segunda passada de QA, também tratado como nulo — idade real de tomador de crédito está entre 18 e 100 anos."),
      bullet("renda_declarada preenchida com texto \"-\" ou \"N/I\" (2.537 registros): nulo disfarçado, convertido para nulo explícito."),
      bullet("cpf com espaços em branco ao redor (2.056 registros em contratos): corrigido, pois quebraria qualquer cruzamento por CPF."),
      bullet("valor_aposta negativo (1.714 registros na base de apostas, ex.: R$ -44,23): preservado na base limpa por não haver confirmação do significado de negócio (estorno vs. erro de captura); neutralizado apenas no cálculo de variáveis de log para a modelagem estatística."),
      p("Após a limpeza: contratos_limpo.csv ficou com 51.819 registros (nulos remanescentes concentrados em score_bureau, idade e renda_declarada, agora nulos reais e mapeáveis) e transacoes_apostas_limpo.csv com 120.964 registros."),

      h1("4. Join das bases"),
      p("A base de apostas é de granularidade transacional (múltiplas linhas por CPF); a base de contratos também tem múltiplas linhas por CPF (um cliente pode ter mais de um contrato). Um join direto linha-a-linha geraria um produto cartesiano sem significado de negócio. A solução adotada foi:"),
      bullet("Agregar transacoes_apostas_limpo por CPF, calculando: quantidade de transações, valor total/médio/máximo apostado, dias distintos de aposta, datas de primeira/última aposta, modalidade/casa/canal preferidos."),
      bullet("Fazer um LEFT JOIN de contratos_limpo (base) com essa agregação, preservando os 51.819 contratos."),
      bullet("Criar a flag possui_apostas (SIM/NAO) para segmentação direta."),
      table(
        ["Métrica", "Valor"],
        [
          ["Linhas na base final", "51.819 (idêntico à base de contratos)"],
          ["Colunas", "28 (18 de contratos + 9 de apostas + 1 flag)"],
          ["CPFs únicos em contratos", "40.000"],
          ["CPFs únicos em apostas", "13.568"],
          ["CPFs em comum", "12.068 (30,2% dos clientes)"],
          ["Contratos com titular apostador", "15.785 (30,5% dos contratos)"],
        ],
        [5000, 4500]
      ),
      caption("Tabela 4 — Resultado do join (contratos_apostas_join.csv)"),

      new Paragraph({ children: [new PageBreak()] }),

      h1("5. Análise exploratória"),
      h2("5.1. Estatísticas descritivas (contratos_limpo)"),
      table(
        ["Métrica", "Valor contratado", "Limite aprovado", "Renda declarada", "Taxa a.m.", "Score", "Idade"],
        [
          ["Média", "R$ 878", "R$ 1.491", "R$ 2.895", "9,50%", "633", "40,4"],
          ["Mediana", "R$ 735", "R$ 1.213", "R$ 2.650", "9,51%", "633", "40"],
          ["Desvio padrão", "574", "1.065", "1.458", "3,20", "90", "12,8"],
          ["Assimetria", "2,14", "2,36", "1,23", "≈0", "≈0", "≈0"],
        ],
        [1600, 1700, 1700, 1700, 1300, 1000, 1000]
      ),
      caption("Tabela 5 — Estatísticas descritivas das principais colunas numéricas"),
      p("Valor, limite e renda têm forte assimetria positiva (poucos contratos de valor alto puxando a cauda) — a mediana é a medida de tendência central mais confiável para esses três campos. Score e idade têm distribuição praticamente simétrica."),

      img(`${IMG_DIR}/03_hist_valor.png`, 560),
      caption("Figura 1 — Distribuição do valor contratado: concentração entre R$ 120 e R$ 1.300 (~82% dos contratos), com cauda longa até R$ 7.907"),

      h2("5.2. Outliers e inconsistências relevantes"),
      bullet("2.403 contratos com valor acima de R$ 2.013 pela regra IQR — não é erro, é a cauda natural do produto; recomenda-se monitoramento de risco separado para \"ticket alto\"."),
      bullet("1.226 contratos com renda_declarada = R$ 0 mas valor contratado positivo — logicamente inconsistente, indica renda não informada corretamente."),
      bullet("3.130 contratos (6,8% da base com renda válida) com valor contratado maior que a renda declarada; 1.251 com valor mais de 3× a renda — merece checagem pontual de fraude ou erro de captura."),
      bullet("Comprometimento de renda (valor/renda) não é preditor forte de inadimplência isoladamente (~17,5% em quase todas as faixas) — o score de bureau já captura esse risco de forma mais eficiente."),

      h2("5.3. Padrão temporal — piora de safra"),
      img(`${IMG_DIR}/02_safra_trend.png`, 560),
      caption("Figura 2 — Evolução da inadimplência por mês de contratação: alta de 15,4% (jun/25) para 19,3% (nov/25)"),
      p("A inadimplência por safra mensal vem subindo de forma praticamente monotônica, com o ticket médio estável — ou seja, a piora não é explicada pelo valor emprestado, mas por uma mudança na composição de risco das safras mais recentes. Esse padrão se conecta diretamente ao achado da seção 6.4 (crescimento da fatia de apostadores na carteira)."),

      h2("5.4. Score de bureau como variável central"),
      img(`${IMG_DIR}/01_score_band.png`, 560),
      caption("Figura 3 — Inadimplência por faixa de score de bureau: de 87,0% (≤400) a 1,3% (801–900)"),
      p("A correlação entre score_bureau e over30_3m é de -0,37, e a relação por faixa é quase um degrau — confirmando que o score está bem calibrado e é a variável isolada de maior poder discriminante da base."),

      h2("5.5. Produto, canal e geografia"),
      table(
        ["Dimensão", "Maior risco", "Menor risco", "Amplitude"],
        [
          ["Produto", "Crediário (20,6%)", "Cartão (15,7%)", "4,9 p.p."],
          ["Canal", "Loja (20,1%)", "Site (15,8%)", "4,3 p.p."],
          ["UF", "Pará (18,4%)", "Goiás (16,7%)", "1,7 p.p."],
        ],
        [2100, 2700, 2700, 2100]
      ),
      caption("Tabela 6 — Inadimplência (over30_3m) por dimensão categórica"),
      p("A combinação de maior risco é Crediário via Loja (23,6%); a de menor risco é Cartão via Parceiro (13,7%) — uma amplitude de quase 10 p.p., maior que qualquer variável isolada. Geografia (UF) tem efeito pequeno e provavelmente não deveria ser usada isoladamente como critério de política."),

      new Paragraph({ children: [new PageBreak()] }),

      h1("6. Apostas × inadimplência — análise cruzada"),

      h2("6.1. Efeito direto"),
      img(`${IMG_DIR}/04_apostas_vs_nao.png`, 560),
      caption("Figura 4 — Inadimplência: 15,0% (sem apostas) vs. 23,3% (com apostas)"),

      h2("6.2. Efeito dose-resposta"),
      img(`${IMG_DIR}/05_dose_resposta.png`, 560),
      caption("Figura 5 — Inadimplência sobe de 20,0% (1–5 apostas) para 36,2% (50+ apostas)"),
      p("O mesmo padrão aparece por valor total apostado: do quintil mais baixo (19,3%) ao mais alto (31,9%). O que prediz risco não é simplesmente \"apostar ou não\", é a intensidade de uso."),

      h2("6.3. O efeito persiste dentro de cada faixa de score"),
      img(`${IMG_DIR}/06_score_x_apostas.png`, 560),
      caption("Figura 6 — Inadimplência com e sem apostas, dentro de cada faixa de score de bureau"),
      table(
        ["Faixa de score", "Sem apostas", "Com apostas", "Diferença", "Risco relativo"],
        [
          ["≤500", "52,2%", "64,3%", "+12,0 p.p.", "1,23x"],
          ["501–600", "24,8%", "33,3%", "+8,5 p.p.", "1,34x"],
          ["601–700", "10,1%", "13,4%", "+3,3 p.p.", "1,32x"],
          ["701–800", "4,0%", "5,0%", "+1,0 p.p.", "1,24x"],
          ["801–900", "1,2%", "1,9%", "+0,7 p.p.", "1,61x"],
        ],
        [2000, 1700, 1700, 1700, 1500]
      ),
      caption("Tabela 7 — Inadimplência por faixa de score, segmentada por possui_apostas"),
      p("O efeito não desaparece em nenhuma faixa — em termos relativos, fica estável entre 1,2x e 1,6x do início ao fim do espectro. Isso indica que o sinal de apostas é incremental ao score, não redundante: mesmo um cliente \"bom\" pelo bureau (score 801–900) tem risco relativo ~60% maior se apostar muito."),

      h2("6.4. A fatia de apostadores na carteira está crescendo"),
      img(`${IMG_DIR}/07_fatia_apostadores.png`, 560),
      caption("Figura 7 — Participação de contratos com titular apostador: de 19,4% (jun/25) a 46,7% (dez/25, parcial)"),
      p("A participação mais que dobrou em seis meses, em trajetória praticamente linear. Isso coincide temporalmente com a piora de safra observada na seção 5.3 — é plausível que parte da deterioração da qualidade de carteira seja explicada por essa mudança de mix, embora uma decomposição formal (controlando pelo mix) seja necessária para afirmar causalidade com mais confiança."),

      h2("6.5. Consistência entre réguas de inadimplência"),
      table(
        ["Régua", "Sem apostas", "Com apostas", "Risco relativo"],
        [
          ["fpd_15 (atraso precoce)", "7,0%", "10,2%", "1,46x"],
          ["over30_3m (30d/3m)", "15,0%", "23,3%", "1,55x"],
          ["over60_6m (60d/6m)", "22,3%", "36,4%", "1,63x"],
        ],
        [3000, 2200, 2200, 2200]
      ),
      caption("Tabela 8 — Risco relativo (com vs. sem apostas) em três réguas de inadimplência"),
      p("O efeito amplifica conforme a régua fica mais severa — mais compatível com fragilidade financeira estrutural e contínua do que com um atraso pontual e circunstancial."),

      new Paragraph({ children: [new PageBreak()] }),

      h1("7. Testes estatísticos de significância"),

      h2("7.1. Qui-quadrado — possui_apostas × over30_3m"),
      table(
        ["Estatística", "Valor"],
        [
          ["χ²", "522,78"],
          ["p-valor", "1,05 × 10⁻¹¹⁵"],
          ["Graus de liberdade", "1"],
          ["V de Cramer (tamanho de efeito)", "0,10"],
        ],
        [5000, 4500]
      ),
      caption("Tabela 9 — Resultado do teste qui-quadrado"),
      p("A associação é estatisticamente significante, com margem extremamente ampla — não é explicada por acaso amostral. Testes equivalentes para fpd_15 (p = 1,45×10⁻³⁵) e over60_6m (p = 1,38×10⁻²⁴⁵) confirmam o padrão."),

      h2("7.2. Regressão logística — controlando por score de bureau"),
      p("Modelo: over30_3m ~ possui_apostas + score_bureau (n = 51.293)"),
      table(
        ["Variável", "Odds Ratio", "IC 95%", "p-valor"],
        [
          ["possui_apostas (SIM vs. NAO)", "1,43", "1,36 – 1,51", "< 0,001"],
          ["score_bureau (a cada +100 pontos)", "0,28", "0,27 – 0,29", "< 0,001"],
        ],
        [3600, 1800, 2400, 1600]
      ),
      caption("Tabela 10 — Odds ratios do modelo logístico principal"),
      p("Mesmo controlando pelo score de bureau — a variável mais forte da base — possuir histórico de apostas aumenta em 43% a chance (odds) de inadimplência. Um teste de razão de verossimilhança confirma que adicionar essa variável melhora o modelo de forma significante (LR = 184,89; p = 4,15×10⁻⁴²)."),

      h2("7.3. Modelo expandido — intensidade de apostas"),
      table(
        ["Variável", "Odds Ratio", "Leitura"],
        [
          ["possui_apostas (flag binária)", "0,85", "isolada, perde força quando o volume entra no modelo"],
          ["log(valor total apostado)", "1,11 por unidade log", "cada aumento no volume eleva o risco"],
          ["score_bureau (+100 pontos)", "0,28", "continua dominante"],
        ],
        [3200, 2200, 3400]
      ),
      caption("Tabela 11 — Modelo expandido com intensidade de apostas"),
      p("Confirma o padrão visual: o que prediz risco não é o simples fato de apostar, é a intensidade — o efeito da flag binária enfraquece quando o volume (contínuo) entra no modelo, pois o volume já carrega a maior parte do sinal."),

      new Paragraph({ children: [new PageBreak()] }),

      h1("8. Insights e recomendações"),

      h2("8.1. Qualidade de dados"),
      bullet("Padronizar produto, canal_originacao/canal e datas na origem (ETL antes de qualquer análise recorrente)."),
      bullet("Adicionar validação de formulário para impedir idade fora de 18–100 anos e CPF com espaços/formatos inconsistentes."),
      bullet("Investigar a causa dos ~1% de contratos sem score de bureau válido — esse grupo tem risco acima da média (19–20% vs. 17,5%), o que pode sinalizar tentativa de burlar a checagem de crédito."),
      bullet("Esclarecer com a área de negócio o significado dos valores negativos em valor_aposta (1.714 registros) antes de decidir tratamento definitivo."),

      h2("8.2. Risco de crédito"),
      bullet("Investigar a piora de safra (jun→nov) junto à área de crédito/produto — é o achado mais acionável da análise, e coincide temporalmente com o crescimento da fatia de apostadores na carteira."),
      bullet("Revisar a combinação Crediário + Loja (23,6% de inadimplência) — simular repricing de taxa ou aperto de critério de aprovação específico."),
      bullet("Monitorar os 1.251 contratos com valor contratado > 3× a renda declarada — checagem pontual de fraude/erro antes de decisões de cobrança."),

      h2("8.3. Uso do sinal de apostas"),
      bullet("O sinal de apostas é estatisticamente robusto, não é explicado pelo score de bureau, e escala com intensidade de uso — há base estatística sólida para incorporá-lo a um modelo de risco ou política de pricing."),
      bullet("Qualquer uso comercial (aprovação/pricing) deve passar por avaliação jurídica e de compliance (LGPD, potencial discriminação indireta) antes de implementação."),

      h2("8.4. Política de corte — recomendação"),
      p("Foram simulados cinco cenários de corte, comparando produção sacrificada (% de contratos excluídos) com redução de risco (queda em p.p. de over30_3m):"),
      table(
        ["Cenário", "Produção perdida", "Queda de risco", "Eficiência (pp / % prod.)"],
        [
          ["A) Cortar todos com histórico de apostas", "30,5%", "2,53 p.p.", "0,083"],
          ["B) Cortar 21+ transações", "3,1%", "0,51 p.p.", "0,165"],
          ["C) Cortar 50+ transações", "1,7%", "0,32 p.p.", "0,188"],
          ["D) Cortar top 20% em valor apostado", "6,1%", "0,94 p.p.", "0,154"],
          ["E) Cortar 11+ apostas E score ≤600", "3,3%", "1,08 p.p.", "0,327"],
        ],
        [3600, 1900, 1900, 2100]
      ),
      caption("Tabela 12 — Simulação de cenários de corte (produção vs. risco)"),
      p("Recomendação: cenário E (corte combinado — intensidade de apostas alta e score de bureau baixo). É ~4x mais eficiente que o corte binário (cenário A), que sacrifica quase um terço da produção para uma redução de risco proporcionalmente pequena. O corte combinado preserva o cliente que aposta pouco mas tem bom score (risco próximo da média da carteira) e o cliente que aposta muito mas tem excelente score (1,9% de inadimplência mesmo com uso intenso), removendo concentração de risco com o menor custo de produção."),

      new Paragraph({ children: [new PageBreak()] }),

      h1("9. Anexo — documentação do código Python"),
      p("Todo o pipeline de análise (raio-X, limpeza, join e testes estatísticos) foi consolidado em um único script documentado, entregue em separado: pipeline_analise_credito_apostas.py. Abaixo, um resumo da estrutura do código."),

      h2("9.1. Estrutura do script"),
      table(
        ["Função", "Etapa", "O que faz"],
        [
          ["parse_valor_monetario()", "Utilitário", "Converte qualquer formato monetário (R$/vírgula/ponto) para float"],
          ["formatar_moeda_br()", "Utilitário", "Formata float para o padrão R$ 1.234,56"],
          ["parse_data_multiformato()", "Utilitário", "Converte string de data testando múltiplos formatos"],
          ["normalizar_identificador()", "Utilitário", "Remove separadores/espaços do CPF e padroniza maiúsculas"],
          ["raio_x_inicial()", "1. Diagnóstico", "Imprime estrutura, tipos, nulos e duplicatas sem alterar os dados"],
          ["limpar_contratos()", "2. Limpeza", "Pipeline completo de limpeza de contratos.csv"],
          ["limpar_apostas()", "3. Limpeza", "Pipeline completo de limpeza de transacoes_apostas.csv"],
          ["agregar_apostas_por_cpf()", "4. Join", "Agrega transações em métricas por CPF"],
          ["join_contratos_apostas()", "4. Join", "LEFT JOIN de contratos com a agregação de apostas"],
          ["preparar_variaveis_join()", "5. Preparo", "Deriva variáveis numéricas para estatística/modelagem"],
          ["teste_qui_quadrado()", "6. Estatística", "Teste de independência + V de Cramer"],
          ["regressao_logistica_risco()", "6. Estatística", "Ajusta os 3 modelos logísticos (base, com apostas, com intensidade)"],
          ["main()", "Orquestração", "Executa o pipeline completo, ponta a ponta"],
        ],
        [2600, 1600, 5300]
      ),
      caption("Tabela 13 — Funções do pipeline consolidado"),

      h2("9.2. Decisões de modelagem documentadas no código"),
      bullet("Detecção de formato monetário: se a string contém vírgula, assume-se formato brasileiro (ponto = milhar); caso contrário, assume-se ponto decimal (formato norte-americano)."),
      bullet("Normalização de CPF: remoção de qualquer caractere não alfanumérico e conversão para maiúsculas, unificando os 3 formatos de origem em uma chave de 11 caracteres — pré-requisito para o join funcionar corretamente."),
      bullet("Agregação antes do join: decisão deliberada para evitar produto cartesiano entre duas bases de granularidade \"many\" (múltiplos contratos e múltiplas apostas por CPF)."),
      bullet("Sentinelas tratados como nulo, não como zero: score_bureau ≤ 0 e idade ≤ 1 ou > 100 são convertidos para NaN, preservando a distinção entre \"valor real igual a zero\" e \"dado ausente/erro\"."),
      bullet("Valores negativos em valor_aposta: mantidos na base limpa (decisão de negócio pendente), mas neutralizados (clip para 0) apenas no cálculo de log para a regressão, evitando erro matemático sem mascarar o dado original."),

      h2("9.3. Reprodutibilidade"),
      p("O script (pipeline_analise_credito_apostas.py, entregue em separado e também listado na íntegra no Anexo C) foi adaptado para execução local no VSCode: os caminhos são relativos ao próprio arquivo (pasta dados/ para entrada, saida/ criada automaticamente). Basta colocar contratos.csv e transacoes_apostas.csv em uma subpasta dados/ e rodar \"python pipeline_analise_credito_apostas.py\". O script imprime no console o raio-X, o relatório de limpeza, o resultado do join e o resumo dos testes estatísticos — permitindo auditar cada etapa e reproduzir integralmente os números apresentados neste relatório."),

      new Paragraph({ children: [new PageBreak()] }),

      h1("Anexo B — Documentação completa do código (texto integral)"),
      ...renderMarkdown(fs.readFileSync("/mnt/user-data/outputs/documentacao_codigo.md", "utf-8")),

      new Paragraph({ children: [new PageBreak()] }),

      h1("Anexo C — Código-fonte completo (pipeline_analise_credito_apostas.py)"),
      p("Listagem integral do script Python entregue em separado, reproduzida aqui para consulta offline."),
      ...renderCode(fs.readFileSync("/mnt/user-data/outputs/pipeline_analise_credito_apostas.py", "utf-8")),
    ],
  }],
});

Packer.toBuffer(doc).then((buffer) => {
  fs.writeFileSync("/mnt/user-data/outputs/relatorio_final_analise_credito_apostas.docx", buffer);
  console.log("Documento gerado com sucesso.");
});
