import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { supabase } from "./supabaseClient";
import {
  Lock, User, Upload, Plus, Trash2, Pencil, LogOut, Image as ImageIcon, Copy, Check,
  Package, Users, GalleryHorizontal, ChevronLeft, ChevronRight, X, ShieldCheck, Eye,
  ShoppingCart, Minus, Mail, MessageCircle, Printer, Settings as SettingsIcon, Download,
  Building2, UserCheck, TrendingUp, PieChart, Archive, BarChart3, Crown, UserCog, ListOrdered, ScanBarcode, Scissors, ChevronDown, Search
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const TOKENS = {
  ink: "#17161A", inkSoft: "#232228", ivory: "#F6F1E8", ivorySoft: "#EDE6D8",
  wine: "#8C3A3A", wineDark: "#6E2C2C", sand: "#C9B08A", graphite: "#5A564C",
  line: "#DCD2BE", ok: "#4B6355",
};

const SIZES = ["P", "M", "G", "GG"];
const DEFAULT_CATEGORIES = ["CONJUNTO DE SHORT", "CONJUNTO DE CALÇA", "MACAQUINHOS", "KIT'S"];

// Se o produto não tem SKU cadastrado, usa as iniciais do nome do modelo em
// vez do nome inteiro — evita código de barras enorme (ex.: "Conjunto Short
// Fly" sem SKU vira "CSF", não "CONJUNTO SHORT FLY").
function shortSkuFor(sku, model) {
  const clean = (sku || "").trim();
  if (clean) return clean;
  const words = (model || "ITEM").trim().split(/\s+/).filter(Boolean);
  if (words.length > 1) return words.map((w) => w[0]).join("").toUpperCase().slice(0, 6) || "ITEM";
  return (words[0] || "ITEM").toUpperCase().slice(0, 6);
}

// Áreas do Painel ADM que podem ser ligadas/desligadas por login de
// funcionário — usado no montador de login (Login de Funcionários) e pra
// filtrar as abas que cada um vê.
const PERMISSION_AREAS = [
  { id: "produtos", label: "Produtos & Estoque" },
  { id: "itens", label: "Listagem de itens" },
  { id: "coleta", label: "Coleta e Estoque" },
  { id: "relatorios-corte", label: "Relatórios Estoque e Corte" },
  { id: "catalogo-modelos", label: "Catálogo de Modelos" },
  { id: "pedidos", label: "Pedidos" },
  { id: "clientes", label: "Clientes (Cadastro)" },
  { id: "login-clientes", label: "Login de Clientes" },
  { id: "representantes", label: "Login de Representantes" },
  { id: "banners", label: "Banners" },
  { id: "config", label: "Configurações" },
];
const ALL_PERMISSION_IDS = PERMISSION_AREAS.map((a) => a.id);
const MONTHS_PT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const STORE_KEYS = {
  users: "catalog_users_v5", products: "catalog_products_v5", banners: "catalog_banners_v5",
  settings: "catalog_settings_v5", clients: "catalog_clients_v5", orders: "catalog_orders_v1",
  stockItems: "catalog_stock_items_v1",
};

function uid(prefix = "") { return prefix + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4); }
function genPass() { const c = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; let s = ""; for (let i = 0; i < 6; i++) s += c[Math.floor(Math.random() * c.length)]; return s; }

// Converte entre o formato usado no app (camelCase) e o formato das tabelas
// reais do Supabase (snake_case), agora que produtos/banners/configurações
// deixaram de ser um bloco único e viraram tabelas de verdade.
function productToRow(p) {
  return { id: p.id, model: p.model, sku: p.sku, category: p.category, description: p.description, price: p.price, cost_price: p.costPrice, variants: p.variants || [], next_item_seq: p.nextItemSeq || 1, ncm: p.ncm || null, cfop: p.cfop || null, unit: p.unit || "UN", cest: p.cest || null };
}
function rowToProduct(r) {
  return { id: r.id, model: r.model, sku: r.sku, category: r.category, description: r.description, price: r.price, costPrice: r.cost_price, variants: r.variants || [], nextItemSeq: r.next_item_seq || 1, ncm: r.ncm || "", cfop: r.cfop || "", unit: r.unit || "UN", cest: r.cest || "" };
}
function bannerToRow(b, i) { return { id: b.id, url: b.url, sort_order: i }; }
function rowToBanner(r) { return { id: r.id, url: r.url }; }

function clientToRow(c) {
  return { id: c.id, buyer_name: c.buyerName, cnpj: c.cnpj || null, cpf: c.cpf || null, ie: c.ie || null,
    email: c.email || null, phone: c.phone || null, address: c.address || null, instagram: c.instagram || null,
    client_references: c.references || null, rep_username: c.repUsername || null, cep: c.cep || null, whatsapp: c.whatsapp || null,
    razao_social: c.razaoSocial || null };
}
function rowToClient(r) {
  return { id: r.id, buyerName: r.buyer_name, cnpj: r.cnpj, cpf: r.cpf, ie: r.ie, email: r.email, phone: r.phone,
    address: r.address, instagram: r.instagram, references: r.client_references, repUsername: r.rep_username, cep: r.cep, whatsapp: r.whatsapp,
    razaoSocial: r.razao_social };
}

function orderToRow(o) {
  return { id: o.id, date: o.date, client_name: o.clientName, seller_name: o.sellerName, seller_role: o.sellerRole,
    seller_username: o.sellerUsername, items: o.items || [], status: o.status, status_log: o.statusLog || [],
    collected_by: o.collectedBy || null, collected_at: o.collectedAt || null, note: o.note || null };
}
function rowToOrder(r) {
  return { id: r.id, date: r.date, clientName: r.client_name, sellerName: r.seller_name, sellerRole: r.seller_role,
    sellerUsername: r.seller_username, items: r.items || [], status: r.status, statusLog: r.status_log || [],
    collectedBy: r.collected_by, collectedAt: r.collected_at, note: r.note };
}

function cutBatchToRow(c) {
  return { id: c.id, product_id: c.productId, variant_id: c.variantId, model: c.model, color: c.color,
    size: c.size, qty: c.qty, cut_by: c.cutBy, cut_at: c.cutAt, status: c.status,
    approved_by: c.approvedBy || null, approved_at: c.approvedAt || null };
}
function rowToCutBatch(r) {
  return { id: r.id, productId: r.product_id, variantId: r.variant_id, model: r.model, color: r.color,
    size: r.size, qty: r.qty, cutBy: r.cut_by, cutAt: r.cut_at, status: r.status,
    approvedBy: r.approved_by, approvedAt: r.approved_at };
}

// Sincroniza uma tabela comparando a lista anterior com a nova, gravando só
// o que mudou (novo ou alterado) e apagando só o que sumiu da lista — ao
// contrário de syncTable (que trata a lista como "a tabela inteira"), este
// é seguro para tabelas onde cada papel só enxerga parte dos dados (ex.:
// um representante só vê os próprios clientes/pedidos), porque nunca mexe
// em linhas que não estavam na lista anterior nem estão na nova.
async function diffSyncTable(table, idField, prevList, nextList, toRow) {
  const prevMap = new Map(prevList.map((x) => [x[idField], x]));
  const nextIds = new Set(nextList.map((x) => x[idField]));
  const toUpsert = nextList.filter((x) => {
    const prev = prevMap.get(x[idField]);
    return !prev || JSON.stringify(prev) !== JSON.stringify(x);
  });
  const toDeleteIds = prevList.filter((x) => !nextIds.has(x[idField])).map((x) => x[idField]);
  if (toUpsert.length) {
    const { error } = await supabase.from(table).upsert(toUpsert.map(toRow));
    if (error) throw error;
  }
  if (toDeleteIds.length) {
    const { error } = await supabase.from(table).delete().in(idField, toDeleteIds);
    if (error) throw error;
  }
}

// Reconhece um código bipado (leitor de código de barras) e descobre qual
// produto/variação/tamanho ele representa — aceita os dois formatos usados
// nas etiquetas: o individual "SKU.7" (Listagem de itens) e o em lote
// "SKU-COR-TAM" (etiquetas por cor/tamanho). Tenta alguns tamanhos de corte
// diferentes pro SKU/cor porque o comprimento mudou entre o PDF e o EPL.
function matchScannedCode(rawCode, products, stockItems) {
  const code = (rawCode || "").trim().toUpperCase();
  if (!code) return null;

  const dotMatch = code.match(/^(.+)\.(\d+)$/);
  if (dotMatch) {
    const item = (stockItems || []).find((si) => `${(si.sku || "").toUpperCase()}.${si.seq}` === code);
    if (item) return { productId: item.productId, variantId: item.variantId, size: item.size };
  }

  const parts = code.split("-");
  if (parts.length >= 3) {
    const size = parts[parts.length - 1];
    const colorCode = parts[parts.length - 2];
    const baseCode = parts.slice(0, -2).join("-");
    for (const p of products) {
      const raw = (p.sku || p.model || "ITEM").toUpperCase().replace(/[^A-Z0-9]/g, "") || "ITEM";
      if (raw.slice(0, 14) !== baseCode && raw.slice(0, 10) !== baseCode) continue;
      const variant = (p.variants || []).find((v) => {
        const rawColor = (v.color || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
        return rawColor.slice(0, 4) === colorCode || rawColor.slice(0, 3) === colorCode;
      });
      if (variant) return { productId: p.id, variantId: variant.id, size };
    }
  }
  return null;
}

// Repete uma chamada ao Supabase (ou a uma função do servidor) até 3 vezes
// se ela vier com erro — cobre a corrida de sessão que pode acontecer logo
// após o login/recarregamento, antes da sessão terminar de "assentar".
// Funciona tanto para supabase.from(...) quanto para supabase.functions.invoke(...),
// já que ambos retornam { data, error }.
async function withRetry(fn) {
  let lastResult;
  for (let attempt = 0; attempt < 3; attempt++) {
    lastResult = await fn();
    if (!lastResult.error) return lastResult;
    if (attempt < 2) await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
  }
  console.error("Erro no Supabase após tentativas:", lastResult.error);
  return lastResult;
}

// Sincroniza uma tabela inteira com a lista de linhas desejada: grava
// (upsert) todas as linhas da lista e apaga do banco qualquer linha que não
// esteja mais nela. Seguro para tabelas onde quem escreve sempre enxerga a
// tabela inteira (produtos, banners, configurações) — não usar em tabelas
// onde um papel só vê parte dos dados (ex.: clientes, pedidos), porque aí
// apagaria linhas de outras pessoas por engano.
async function syncTable(table, idField, rows) {
  if (rows.length) {
    const { error } = await supabase.from(table).upsert(rows);
    if (error) throw error;
  }
  let del = supabase.from(table).delete();
  del = rows.length
    ? del.not(idField, "in", `(${rows.map((r) => `"${r[idField]}"`).join(",")})`)
    : del.neq(idField, "__none__");
  const { error: delError } = await del;
  if (delError) throw delError;
}
function normalizeSearch(str) { return String(str || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim(); }
function parseBRL(str) { const n = parseFloat(String(str || "0").replace(/\./g, "").replace(",", ".")); return isNaN(n) ? 0 : n; }
function formatBRL(n) { return n.toFixed(2).replace(".", ","); }

async function fileToCompressedDataUrl(file, maxW = 900, quality = 0.72) {
  const dataUrl = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
  const img = await new Promise((res, rej) => { const im = new window.Image(); im.onload = () => res(im); im.onerror = rej; im.src = dataUrl; });
  const scale = Math.min(1, maxW / img.width);
  const canvas = document.createElement("canvas");
  canvas.width = img.width * scale; canvas.height = img.height * scale;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", quality);
}

async function buildOrderImage(cart, session, showPrice, client) {
  const rowH = 96, width = 640, headerH = client ? 118 : 90;
  const footerH = showPrice ? 50 : 20;
  const height = headerH + cart.length * rowH + footerH + 20;
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#F6F1E8"; ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#17161A"; ctx.font = "bold 22px Georgia, serif";
  ctx.fillText(`Pedido - ${session.name || session.username}`, 24, 36);
  ctx.font = "12px sans-serif"; ctx.fillStyle = "#5A564C";
  ctx.fillText(new Date().toLocaleDateString("pt-BR"), 24, 56);
  let headerBottom = 70;
  if (client) {
    ctx.fillStyle = "#8C3A3A"; ctx.font = "bold 13px sans-serif";
    ctx.fillText(`Cliente: ${client.buyerName}${client.cnpj ? "  CNPJ: " + client.cnpj : ""}`, 24, 76);
    headerBottom = 96;
  }
  ctx.strokeStyle = "#DCD2BE"; ctx.beginPath(); ctx.moveTo(24, headerBottom); ctx.lineTo(width - 24, headerBottom); ctx.stroke();

  let y = headerH;
  for (const c of cart) {
    if (c.image) {
      try {
        const img = await new Promise((res, rej) => { const im = new window.Image(); im.onload = () => res(im); im.onerror = rej; im.src = c.image; });
        ctx.drawImage(img, 24, y, 64, 82);
      } catch (e) { ctx.fillStyle = "#EDE6D8"; ctx.fillRect(24, y, 64, 82); }
    } else { ctx.fillStyle = "#EDE6D8"; ctx.fillRect(24, y, 64, 82); }
    ctx.fillStyle = "#17161A"; ctx.font = "bold 14px sans-serif";
    ctx.fillText(`${c.qty}x ${c.model}`, 100, y + 22);
    ctx.font = "12px sans-serif"; ctx.fillStyle = "#5A564C";
    ctx.fillText(`Cor: ${c.color}  ·  Tam: ${c.size}`, 100, y + 42);
    if (showPrice) { ctx.fillStyle = "#8C3A3A"; ctx.font = "bold 13px sans-serif"; ctx.fillText(`R$ ${formatBRL(parseBRL(c.price) * c.qty)}`, 100, y + 64); }
    y += rowH;
  }
  if (showPrice) {
    const total = cart.reduce((a, c) => a + parseBRL(c.price) * c.qty, 0);
    ctx.fillStyle = "#17161A"; ctx.font = "bold 18px Georgia, serif";
    ctx.fillText(`Total: R$ ${formatBRL(total)}`, 24, y + 30);
  }
  return canvas.toDataURL("image/png");
}

// Carrega a biblioteca jsPDF sob demanda, direto de um CDN — não precisa de
// npm install nem de mexer no index.html. Só busca o script uma vez.
let _jsPdfLoading = null;
function loadJsPDF() {
  if (window.jspdf?.jsPDF) return Promise.resolve(window.jspdf.jsPDF);
  if (_jsPdfLoading) return _jsPdfLoading;
  _jsPdfLoading = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
    script.onload = () => resolve(window.jspdf.jsPDF);
    script.onerror = () => reject(new Error("Falha ao carregar jsPDF"));
    document.head.appendChild(script);
  });
  return _jsPdfLoading;
}

// Mesmo esquema para a biblioteca de código de barras (JsBarcode), usada nas
// etiquetas de estoque.
let _jsBarcodeLoading = null;
function loadJsBarcode() {
  if (window.JsBarcode) return Promise.resolve(window.JsBarcode);
  if (_jsBarcodeLoading) return _jsBarcodeLoading;
  _jsBarcodeLoading = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/jsbarcode/3.12.3/JsBarcode.all.min.js";
    script.onload = () => resolve(window.JsBarcode);
    script.onerror = () => reject(new Error("Falha ao carregar JsBarcode"));
    document.head.appendChild(script);
  });
  return _jsBarcodeLoading;
}

// Mesmo esquema para a biblioteca de planilhas (SheetJS/xlsx), usada nas
// exportações de Clientes e Estoque em Excel.
let _xlsxLoading = null;
function loadXLSX() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  if (_xlsxLoading) return _xlsxLoading;
  _xlsxLoading = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    script.onload = () => resolve(window.XLSX);
    script.onerror = () => reject(new Error("Falha ao carregar XLSX"));
    document.head.appendChild(script);
  });
  return _xlsxLoading;
}
function downloadXLSX(XLSX, rows, sheetName, filename) {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename);
}


// etiqueta com 33 x 21mm e 0,2mm de distância entre as colunas — pronto
// pra folha de etiqueta autoadesiva com 3 colunas. Sempre gerada nessa
// mesma sequência (esquerda pra direita, cima pra baixo), independente de
// qual tela pediu a etiqueta.
// Todas as etiquetas saem numa grade de 3 colunas por folha A4, cada
// etiqueta com 33 x 21mm e 0,2mm de distância entre as colunas — pronto
// pra folha de etiqueta autoadesiva com 3 colunas. Sempre gerada nessa
// mesma sequência (esquerda pra direita, cima pra baixo), independente de
// qual tela pediu a etiqueta.
const LABEL_W = 33, LABEL_H = 21, LABEL_GAP = 0.2, LABEL_COLS = 3, LABEL_MARGIN_X = 8, LABEL_MARGIN_Y = 8;

function drawLabel(doc, x, y, model, color, size, code, barcodeDataUrl) {
  // Nome do modelo: fonte um pouco maior e centralizado.
  doc.setFont("helvetica", "bold"); doc.setFontSize(6.5); doc.setTextColor(23, 22, 26);
  doc.text(model || "", x + LABEL_W / 2, y + 2.8, { maxWidth: LABEL_W - 2, align: "center" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(4.6); doc.setTextColor(90, 86, 76);
  doc.text(color || "", x + 1.5, y + 5.6);
  // Tamanho da peça (P/M/G/GG), centralizado e um pouco mais pra baixo.
  doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(23, 22, 26);
  doc.text(size || "", x + LABEL_W / 2, y + 11.3, { align: "center" });
  // Código de barras centralizado de verdade no meio da etiqueta.
  doc.addImage(barcodeDataUrl, "PNG", x + 1.5, y + 13, LABEL_W - 3, 5.5);
  doc.setFont("helvetica", "normal"); doc.setFontSize(4.4); doc.setTextColor(23, 22, 26);
  doc.text(code, x + LABEL_W / 2, y + LABEL_H - 1.3, { align: "center" });
}

// Gera o comando EPL2 (texto puro, não PDF) para a Zebra GC420t — a própria
// impressora entende esse texto direto, sem depender de escala/driver do
// Windows. Calculado para etiqueta 33 x 21mm a 203dpi (8 pontos por mm).
// Gera um CSV simples (Modelo, CorTamanho, Codigo) para ser usado como
// fonte de dados no ZebraDesigner — mais confiável que mandar comando EPL
// direto, já que o ZebraDesigner já sabe conversar certo com a impressora.
function buildLabelsCsv(entries) {
  const esc = (v) => `"${String(v || "").replace(/"/g, '""')}"`;
  const rows = ["Modelo,CorTamanho,Codigo"];
  entries.forEach((e) => { rows.push([e.model, `${e.color || ""} - ${e.size || ""}`, e.code].map(esc).join(",")); });
  return rows.join("\r\n");
}
function downloadCsvFile(text, filename) {
  const blob = new Blob(["\uFEFF" + text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

// "gapDots" é a distância entre etiquetas na bobina — ajuste se a etiqueta
// sair descolocada (cada etiqueta física normalmente tem uns 2-3mm de vão).
// Estimativa de largura (em pontos/dots) que um código CODE128 vai ocupar
// impresso, pra poder centralizar de verdade — a impressora não deixa a
// gente perguntar a largura final, então calculamos pela regra do próprio
// CODE128: ~11 módulos por caractere + início/checksum/fim, vezes a
// largura da barra mais estreita (narrowBar).
function estimateBarcodeWidthDots(code, narrowBar) {
  const modules = 11 * (String(code || "").length + 2) + 13;
  return modules * narrowBar;
}

// Calcula o X pra centralizar um texto EPL dentro da largura da etiqueta —
// o comando "A" do EPL não tem "centralizar" pronto, então estimamos a
// largura pelo número de caracteres vezes a largura aproximada de cada um
// (charW, que já vem multiplicada pelo multiplicador horizontal usado).
function eplCenterX(xBase, labelW, text, charW) {
  const w = charW * ((text || "").length || 1);
  return Math.max(xBase, xBase + Math.round((labelW - w) / 2));
}

function buildEplLabels(entries, gapDots = 24) {
  const DPMM = 8; // 203dpi = 8 pontos por mm
  const LABEL_W = Math.round(33 * DPMM); // 264
  const LABEL_H = Math.round(21 * DPMM); // 168
  const COLS = 3; // a folha física tem 3 etiquetas lado a lado
  const ROWS_PER_BATCH = 6; // quantas fileiras viram "uma etiqueta só" por vez
  const margin = 20; // mesma margem do teste que já imprimiu certinho
  const rowWidth = LABEL_W * COLS + gapDots * (COLS - 1);
  const narrowBar = 1;
  const barHeight = 35;

  // Agrupa as fileiras em lotes e trata cada lote como UMA ÚNICA etiqueta
  // "alta" (várias fileiras reais empilhadas, com o espaço em branco exato
  // onde ficam os vãos reais entre elas). A impressora só precisa se
  // localizar (sensor de vão) uma vez no início de cada lote, em vez de a
  // cada fileira — era aí que ela perdia a posição e pulava etiquetas.
  const rows = [];
  for (let i = 0; i < entries.length; i += COLS) rows.push(entries.slice(i, i + COLS));

  let out = `D12\nS2\nq${rowWidth}\n`;
  for (let b = 0; b < rows.length; b += ROWS_PER_BATCH) {
    const batchRows = rows.slice(b, b + ROWS_PER_BATCH);
    const batchHeight = batchRows.length * LABEL_H + (batchRows.length - 1) * gapDots;
    out += `Q${batchHeight},${gapDots}\n`;
    out += `N\n`;
    batchRows.forEach((rowEntries, r) => {
      const yBase = r * (LABEL_H + gapDots);
      rowEntries.forEach((e, col) => {
        const xBase = col * (LABEL_W + gapDots) + margin;
        const code = (e.code || "").replace(/["\\]/g, "").toUpperCase();
        const model = (e.model || "").replace(/["\\]/g, "").slice(0, 24).toUpperCase();
        const color = (e.color || "").replace(/["\\]/g, "").toUpperCase();
        const size = (e.size || "").replace(/["\\]/g, "").toUpperCase();
        // Barra centralizada de verdade dentro da etiqueta, calculando a
        // largura real que ela vai sair impressa.
        const barW = estimateBarcodeWidthDots(code, narrowBar);
        const barX = Math.max(xBase, xBase + Math.round((LABEL_W - barW) / 2));
        // Nome do modelo: fonte um pouco maior (fonte 2 em vez de 1) e centralizado.
        const nameX = eplCenterX(xBase, LABEL_W, model, 11);
        out += `A${nameX},${yBase + 4},0,2,1,1,N,"${model}"\n`;
        out += `A${xBase},${yBase + 20},0,1,1,1,N,"${color}"\n`;
        // Tamanho da peça (P/M/G/GG), centralizado e um pouco mais pra baixo.
        const sizeMult = 2;
        const sizeX = eplCenterX(xBase, LABEL_W, size, 9 * sizeMult);
        out += `A${sizeX},${yBase + 42},0,1,${sizeMult},${sizeMult},N,"${size}"\n`;
        out += `B${barX},${yBase + 86},0,1B,${narrowBar},1,${barHeight},N,"${code}"\n`;
        // Código embaixo, também centralizado (fonte 2, ~11pt por caractere).
        const codeX = eplCenterX(xBase, LABEL_W, code, 11);
        out += `A${codeX},${yBase + 128},0,2,1,1,N,"${code}"\n`;
      });
    });
    out += `P1\n`;
  }
  return out;
}

function downloadEplFile(text, filename) {
  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

// Recebe uma lista de etiquetas já expandida — uma entrada por peça física
// — no formato { model, color, size, code }, e desenha todas na grade.
async function buildLabelsGridPdf(entries) {
  if (!entries || !entries.length) return null;
  const jsPDF = await loadJsPDF();
  const JsBarcode = await loadJsBarcode();
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const rowsPerPage = Math.floor((297 - 2 * LABEL_MARGIN_Y) / LABEL_H);
  const perPage = rowsPerPage * LABEL_COLS;

  entries.forEach((e, i) => {
    const posOnPage = i % perPage;
    if (i > 0 && posOnPage === 0) doc.addPage();
    const row = Math.floor(posOnPage / LABEL_COLS);
    const col = posOnPage % LABEL_COLS;
    const x = LABEL_MARGIN_X + col * (LABEL_W + LABEL_GAP);
    const y = LABEL_MARGIN_Y + row * LABEL_H;

    const canvas = document.createElement("canvas");
    JsBarcode(canvas, e.code, { format: "CODE128", width: 1, height: 35, displayValue: false, margin: 0 });
    drawLabel(doc, x, y, e.model, e.color, e.size, e.code, canvas.toDataURL("image/png"));
  });
  return doc.output("blob");
}

// Gera as etiquetas de UMA cor/variação, repetindo a etiqueta de cada
// tamanho conforme a quantidade escolhida em qtyBySize (ex.: {P:10, M:0,
// G:0, GG:6} gera 10 etiquetas de P e 6 de GG). O código combina SKU (ou
// nome do modelo) + cor + tamanho, para ficar único por peça.
async function buildStockLabelsPdfBlob(productModel, productSku, variant, qtyBySize) {
  const baseCode = shortSkuFor(productSku, productModel).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 14) || "ITEM";
  const colorCode = (variant.color || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
  const entries = [];
  SIZES.forEach((s) => {
    const n = Math.max(0, Math.floor(Number(qtyBySize?.[s]) || 0));
    for (let i = 0; i < n; i++) entries.push({ model: productModel, color: variant.color, size: s, code: `${baseCode}-${colorCode}-${s}` });
  });
  return buildLabelsGridPdf(entries);
}

// Gera etiquetas a partir de uma lista de peças específicas (usado pela
// Listagem de itens — imprimir uma peça ou várias selecionadas). Cada
// entrada precisa de { model, color, size, code }, onde code já vem pronto
// (ex.: "MC01.7") — o código de barras usa exatamente esse texto, dando
// rastreabilidade única por peça.
async function buildItemLabelsPdfBlob(entries) {
  return buildLabelsGridPdf(entries);
}

// Gera um PDF real (sempre 1 página, a menos que o pedido seja gigante) a partir
// de uma lista de itens de pedido. Usado tanto no carrinho do cliente quanto na
// aba Pedidos do painel — troca window.print() (que duplicava página) por um PDF
// de verdade, que também pode ser anexado no compartilhamento do WhatsApp.
// Gera um catálogo em PDF com todo o estoque atual — uma linha por
// produto/cor, com a foto principal, e a quantidade de cada tamanho
// separada em Pronta entrega e Em produção (só mostra a segunda linha
// quando existir algo em produção pra aquela cor).
async function buildCatalogPdfBlob(products) {
  const jsPDF = await loadJsPDF();
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 32, marginTop = 60, marginBottom = 40;
  const cols = 3;
  const gap = 14;
  const cardW = (pageWidth - marginX * 2 - gap * (cols - 1)) / cols;
  const cardH = 195;
  let x = marginX, y = marginTop, col = 0;

  function drawHeader() {
    doc.setFont("times", "bold"); doc.setFontSize(16); doc.setTextColor(23, 22, 26);
    doc.text("Catálogo Mallo — disponível agora", marginX, 36);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(90, 86, 76);
    doc.text(new Date().toLocaleString("pt-BR"), marginX, 50);
  }
  drawHeader();

  // Uma linha por produto — só mostra as cores que têm alguma disponibilidade
  // (pronta ou em produção), sem números de estoque, só a bolinha da cor.
  const rows = [];
  products.forEach((p) => {
    const coresDisponiveis = (p.variants || []).filter((v) => {
      const pronta = SIZES.reduce((a, s) => a + (v.stock?.[s] || 0), 0);
      const producao = SIZES.reduce((a, s) => a + (v.stockProducao?.[s] || 0), 0);
      return pronta > 0 || producao > 0;
    });
    if (coresDisponiveis.length) rows.push({ p, cores: coresDisponiveis });
  });

  for (const { p, cores } of rows) {
    if (y + cardH > pageHeight - marginBottom) {
      doc.addPage(); x = marginX; y = marginTop; col = 0; drawHeader();
    }
    doc.setDrawColor(220, 210, 190);
    doc.rect(x, y, cardW, cardH);
    const img = cores[0].images && cores[0].images[0];
    const imgH = 130;
    if (img) {
      try {
        const el = await new Promise((res, rej) => { const im = new window.Image(); im.onload = () => res(im); im.onerror = rej; im.src = img; });
        doc.addImage(el, "JPEG", x + 4, y + 4, cardW - 8, imgH);
      } catch (e) { console.error("Catálogo: falha ao carregar foto", p.model, e); }
    } else {
      doc.setFillColor(240, 236, 226);
      doc.rect(x + 4, y + 4, cardW - 8, imgH, "F");
    }
    let ty = y + imgH + 18;
    doc.setFont("helvetica", "bold"); doc.setFontSize(10.5); doc.setTextColor(23, 22, 26);
    doc.text(p.model, x + 6, ty, { maxWidth: cardW - 12 });
    ty += 13;
    if (p.category) {
      doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(90, 86, 76);
      doc.text(p.category, x + 6, ty, { maxWidth: cardW - 12 });
      ty += 14;
    } else {
      ty += 4;
    }
    // Bolinhas de cor, lado a lado
    let bx = x + 8;
    const dotR = 5;
    cores.forEach((v) => {
      const hex = v.hex || "#CCCCCC";
      const rgb = [parseInt(hex.slice(1, 3), 16) || 0, parseInt(hex.slice(3, 5), 16) || 0, parseInt(hex.slice(5, 7), 16) || 0];
      doc.setFillColor(...rgb);
      doc.setDrawColor(180, 170, 150);
      doc.circle(bx, ty, dotR, "FD");
      bx += dotR * 2 + 6;
    });

    col++;
    if (col >= cols) { col = 0; x = marginX; y += cardH + gap; }
    else { x += cardW + gap; }
  }

  return doc.output("blob");
}



async function buildOrderPdfBlob(items, session, showPrice, client, note) {
  const jsPDF = await loadJsPDF();
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 40;
  let y = 46;

  doc.setFont("times", "bold"); doc.setFontSize(17); doc.setTextColor(23, 22, 26);
  doc.text(`Pedido - ${session?.name || session?.username || ""}`, marginX, y);
  y += 18;
  doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(90, 86, 76);
  doc.text(new Date().toLocaleDateString("pt-BR"), marginX, y);
  y += 14;
  if (client) {
    doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(140, 58, 58);
    doc.text(`Cliente: ${client.buyerName}${client.cnpj ? "  CNPJ: " + client.cnpj : ""}`, marginX, y);
    y += 16;
  }
  if (note) {
    const noteLines = doc.splitTextToSize(`Observações: ${note}`, pageWidth - marginX * 2 - 16);
    const boxH = noteLines.length * 12 + 10;
    doc.setFillColor(250, 238, 218);
    doc.rect(marginX, y - 10, pageWidth - marginX * 2, boxH, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(99, 56, 6);
    doc.text(noteLines, marginX + 8, y);
    y += boxH + 8;
  }
  doc.setDrawColor(220, 210, 190);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 22;

  async function drawItem(c) {
    if (y > 760) { doc.addPage(); y = 46; }
    if (c.image) {
      try {
        const img = await new Promise((res, rej) => { const im = new window.Image(); im.onload = () => res(im); im.onerror = rej; im.src = c.image; });
        doc.addImage(img, "JPEG", marginX, y, 46, 58);
      } catch (e) { console.error("PDF: não foi possível carregar a foto do item", c.model, e); }
    }
    doc.setFont("helvetica", "bold"); doc.setFontSize(15); doc.setTextColor(140, 58, 58);
    const qtyLabel = `${c.qty}x`;
    doc.text(qtyLabel, marginX + 58, y + 16);
    const qtyWidth = doc.getTextWidth(qtyLabel);
    doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(23, 22, 26);
    doc.text(c.model, marginX + 58 + qtyWidth + 5, y + 16);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(90, 86, 76);
    doc.text(`Cor: ${c.color}  ·  Tam: ${c.size}${c.sku ? `  ·  SKU: ${c.sku}` : ""}`, marginX + 58, y + 32);
    if (showPrice) {
      doc.setFont("helvetica", "bold"); doc.setFontSize(10.5); doc.setTextColor(140, 58, 58);
      doc.text(`R$ ${formatBRL(parseBRL(c.price) * c.qty)}`, marginX + 58, y + 50);
    }
    y += 68;
  }

  function drawSectionHeader(label, color) {
    if (y > 740) { doc.addPage(); y = 46; }
    doc.setFillColor(...color);
    doc.rect(marginX, y - 12, pageWidth - marginX * 2, 20, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(10.5); doc.setTextColor(255, 255, 255);
    doc.text(label, marginX + 8, y + 2);
    y += 24;
  }

  // Separa os itens do carrinho/pedido em duas seções — pronta entrega e em
  // produção (corte já aprovado, ainda sendo costurado) — pra ficar claro
  // pra quem recebe o pedido o que sai na hora e o que ainda tem prazo.
  const pronta = items.filter((c) => (c.stockType || "pronta") !== "producao");
  const producao = items.filter((c) => c.stockType === "producao");

  if (pronta.length) {
    drawSectionHeader("PRONTA ENTREGA", [99, 153, 34]);
    for (const c of pronta) await drawItem(c);
  }
  if (producao.length) {
    drawSectionHeader("EM PRODUÇÃO — até 30 dias", [186, 117, 23]);
    for (const c of producao) await drawItem(c);
  }

  if (showPrice) {
    const total = items.reduce((a, c) => a + parseBRL(c.price) * c.qty, 0);
    if (y > 760) { doc.addPage(); y = 46; }
    doc.setFont("times", "bold"); doc.setFontSize(15); doc.setTextColor(23, 22, 26);
    doc.text(`Total: R$ ${formatBRL(total)}`, marginX, y + 20);
  }
  return doc.output("blob");
}

// Camada de armazenamento — agora conversando com o Supabase (banco de dados na nuvem)
// em vez da "gaveta" interna do Claude. Guardamos cada "chave" do app (produtos,
// usuários, pedidos, etc.) como uma linha na tabela app_data, com o valor em JSONB.
// Isso mantém todo o resto do código (App, componentes, lógica) exatamente igual.
async function storageGet(key) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const { data, error } = await supabase.from("app_data").select("value").eq("key", key).maybeSingle();
      if (error) throw error;
      return data ? data.value : null;
    } catch (e) {
      if (attempt < 2) { await new Promise((r) => setTimeout(r, 500 * (attempt + 1))); continue; }
      console.error("Erro lendo do Supabase:", key, e.message || e);
      return null;
    }
  }
}
async function storageSet(key, value) {
  try {
    const { error } = await supabase.from("app_data").upsert({ key, value, updated_at: new Date().toISOString() });
    if (error) throw error;
    return true;
  } catch (e) {
    console.error("Erro salvando no Supabase:", key, e.message || e);
    return false;
  }
}

/* ---------------- reports helpers ---------------- */
function computeMonthlySales(orders) {
  const now = new Date();
  const year = now.getFullYear();
  const totals = MONTHS_PT.map((m, i) => ({ month: m, monthIndex: i, revenue: 0, qty: 0 }));
  orders.forEach((o) => {
    const d = new Date(o.date);
    if (d.getFullYear() === year) {
      const idx = d.getMonth();
      const orderRevenue = o.items.reduce((a, it) => a + it.price * it.qty, 0);
      const orderQty = o.items.reduce((a, it) => a + it.qty, 0);
      totals[idx].revenue += orderRevenue;
      totals[idx].qty += orderQty;
    }
  });
  return { year, totals };
}
function computeRanking(orders, colorFilter, sizeFilter) {
  const map = {};
  orders.forEach((o) => o.items.forEach((it) => {
    if (colorFilter && it.color !== colorFilter) return;
    if (sizeFilter && it.size !== sizeFilter) return;
    if (!map[it.model]) map[it.model] = { model: it.model, qty: 0, revenue: 0 };
    map[it.model].qty += it.qty;
    map[it.model].revenue += it.price * it.qty;
  }));
  return Object.values(map).sort((a, b) => b.qty - a.qty);
}
function computeABC(orders) {
  const map = {};
  orders.forEach((o) => o.items.forEach((it) => {
    if (!map[it.model]) map[it.model] = { model: it.model, revenue: 0 };
    map[it.model].revenue += it.price * it.qty;
  }));
  const list = Object.values(map).sort((a, b) => b.revenue - a.revenue);
  const total = list.reduce((a, x) => a + x.revenue, 0) || 1;
  let cum = 0;
  return list.map((x) => {
    cum += x.revenue;
    const cumPct = (cum / total) * 100;
    const cls = cumPct <= 80 ? "A" : cumPct <= 95 ? "B" : "C";
    return { ...x, pct: (x.revenue / total) * 100, cumPct, cls };
  });
}

// Contas cujo e-mail de login (Supabase Auth) não segue o padrão
// usuario@mallo.internal — hoje só o admincentral, que foi criado com um
// e-mail próprio. Novas contas (via "Gerar login") sempre seguem o padrão.
const AUTH_EMAIL_OVERRIDES = { admincentral: "rep.mauricio@hotmail.com" };

// Cloudflare Turnstile (captcha) na tela de login, para dificultar tentativas
// automatizadas de adivinhar senha. Site Key é pública, sem problema ficar
// aqui no código.
const TURNSTILE_SITE_KEY = "0x4AAAAAAE9XTMAIWtvzNTtL";
let _turnstileLoading = null;
function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (_turnstileLoading) return _turnstileLoading;
  _turnstileLoading = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
    script.async = true; script.defer = true;
    script.onload = () => resolve(window.turnstile);
    script.onerror = () => reject(new Error("Falha ao carregar o captcha"));
    document.head.appendChild(script);
  });
  return _turnstileLoading;
}

const SEED_PRODUCTS = [
  {
    id: uid("p_"), model: "Vestido Aurora", category: "Macaquinhos", description: "Vestido midi em viscose fluida, decote V e amarração no cós.", price: "189,90", costPrice: "89,00",
    variants: [
      { id: uid("v_"), color: "Terracota", hex: "#C1633B", images: [], stock: { P: 8, M: 12, G: 6, GG: 0 } },
      { id: uid("v_"), color: "Preto", hex: "#1B1B1B", images: [], stock: { P: 4, M: 6, G: 5, GG: 2 } },
      { id: uid("v_"), color: "Marfim", hex: "#EFE7D8", images: [], stock: { P: 3, M: 3, G: 0, GG: 0 } },
    ],
  },
  {
    id: uid("p_"), model: "Conjunto Nômade", category: "Conjunto de Calça", description: "Cropped canelado + calça pantalona em malha premium.", price: "249,90", costPrice: "120,00",
    variants: [
      { id: uid("v_"), color: "Vinho", hex: "#7A2E38", images: [], stock: { P: 5, M: 9, G: 9, GG: 3 } },
      { id: uid("v_"), color: "Areia", hex: "#D8C9A3", images: [], stock: { P: 6, M: 6, G: 4, GG: 0 } },
    ],
  },
];

const CLIENT_FIELDS = [
  { key: "buyerName", label: "Nome da(o) responsável por compras" },
  { key: "razaoSocial", label: "Razão Social" },
  { key: "cnpj", label: "CNPJ" },
  { key: "ie", label: "Inscrição Estadual" },
  { key: "cpf", label: "CPF" },
  { key: "cep", label: "CEP" },
  { key: "address", label: "Endereço" },
  { key: "email", label: "E-mail" },
  { key: "phone", label: "Telefone" },
  { key: "whatsapp", label: "WhatsApp" },
  { key: "instagram", label: "Instagram" },
  { key: "references", label: "Referências comerciais" },
];

// Aplica a máscara enquanto digita — só números entram, os pontos/traço/barra
// aparecem sozinhos.
function maskCNPJ(v) {
  const d = v.replace(/\D/g, "").slice(0, 14);
  if (d.length > 12) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2})/, "$1.$2.$3/$4-$5");
  if (d.length > 8) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{0,4})/, "$1.$2.$3/$4");
  if (d.length > 5) return d.replace(/^(\d{2})(\d{3})(\d{0,3})/, "$1.$2.$3");
  if (d.length > 2) return d.replace(/^(\d{2})(\d{0,3})/, "$1.$2");
  return d;
}
// Confere o dígito verificador de verdade (algoritmo oficial da Receita),
// não só a formatação — pega CNPJ digitado errado ou inventado.
function isValidCNPJ(v) {
  const d = (v || "").replace(/\D/g, "");
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const calc = (base) => {
    let pesos = base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const soma = base.split("").reduce((a, n, i) => a + Number(n) * pesos[i], 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  const dv1 = calc(d.slice(0, 12));
  const dv2 = calc(d.slice(0, 12) + dv1);
  return d === d.slice(0, 12) + dv1 + dv2;
}
function maskCEP(v) {
  const d = v.replace(/\D/g, "").slice(0, 8);
  if (d.length > 5) return d.replace(/^(\d{5})(\d{0,3})/, "$1-$2");
  return d;
}
// Busca gratuita: CEP na ViaCEP, CNPJ na BrasilAPI (que puxa da Receita
// Federal) — as duas são públicas, sem chave, padrão no Brasil pra isso.
async function buscarCEP(cepDigits) {
  try {
    const res = await fetch(`https://viacep.com.br/ws/${cepDigits}/json/`);
    const data = await res.json();
    if (data.erro) return null;
    return data;
  } catch { return null; }
}
async function buscarCNPJ(cnpjDigits) {
  try {
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjDigits}`);
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

export default function App() {
  const [booted, setBooted] = useState(false);
  const [users, setUsers] = useState({});
  const [products, setProducts] = useState([]);
  const [banners, setBanners] = useState([]);
  const [settings, setSettings] = useState({ orderEmail: "", orderWhatsapp: "", fiscalEmitente: {}, categoryGroups: {} });
  const [clients, setClients] = useState([]);
  const [orders, setOrders] = useState([]);
  const [stockItems, setStockItems] = useState([]);
  const [cutBatches, setCutBatches] = useState([]);
  const [session, setSession] = useState(null);
  const [screen, setScreen] = useState("catalog");
  const [cart, setCart] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);

  // Não busca mais nada do banco aqui: a leitura agora exige login de
  // verdade (Supabase Auth), então os dados só são carregados depois que o
  // login é confirmado (ver loadAppData / handleLogin).
  useEffect(() => { setBooted(true); }, []);

  async function loadAppData() {
    await supabase.auth.getSession(); // garante que a sessão já está pronta antes das buscas abaixo
    const [profRows, pRows, bRows, sRow, clRows, ordRows, siRows, cbRows] = await Promise.all([
      withRetry(() => supabase.from("profiles").select("*")),
      withRetry(() => supabase.from("products").select("*")),
      withRetry(() => supabase.from("banners").select("*").order("sort_order")),
      withRetry(() => supabase.from("settings").select("*").eq("id", 1).maybeSingle()),
      withRetry(() => supabase.from("clients").select("*")),
      withRetry(() => supabase.from("orders").select("*")),
      withRetry(() => supabase.from("stock_items").select("*")),
      withRetry(() => supabase.from("cut_batches").select("*")),
    ]);
    const finalUsers = {};
    (profRows.data || []).forEach((p) => { finalUsers[p.username] = { name: p.name, role: p.role, access: p.access, permissions: p.permissions, authEmail: AUTH_EMAIL_OVERRIDES[p.username] || `${p.username}@mallo.internal` }; });
    setUsers(finalUsers);
    setProducts((pRows.data || []).map(rowToProduct));
    setBanners((bRows.data || []).map(rowToBanner));
    setSettings(sRow.data ? { orderEmail: sRow.data.order_email || "", orderWhatsapp: sRow.data.order_whatsapp || "", categories: sRow.data.categories?.length ? sRow.data.categories : DEFAULT_CATEGORIES, colors: sRow.data.colors || [], fiscalEmitente: sRow.data.fiscal_emitente || {}, categoryGroups: sRow.data.category_groups || {} } : { orderEmail: "", orderWhatsapp: "", categories: DEFAULT_CATEGORIES, colors: [], fiscalEmitente: {}, categoryGroups: {} });
    setClients((clRows.data || []).map(rowToClient)); setOrders((ordRows.data || []).map(rowToOrder));
    setStockItems((siRows.data || []).map(rowToStockItem));
    setCutBatches((cbRows.data || []).map(rowToCutBatch));
    return finalUsers;
  }

  // A gravação de verdade de contas (criar/revogar) já acontece na função
  // segura do servidor (staff-accounts), que mexe direto nas tabelas
  // profiles/auth. Isso aqui só atualiza a tela na hora, sem gravar nada —
  // evitar escrever num lugar que ninguém mais lê.
  const persistUsers = useCallback((next) => { setUsers(next); }, []);
  const persistProducts = useCallback(async (next) => {
    setProducts(next);
    try { await syncTable("products", "id", next.map(productToRow)); } catch (e) { console.error("Erro ao salvar produtos:", e); }
  }, []);
  const persistBanners = useCallback(async (next) => {
    setBanners(next);
    try { await syncTable("banners", "id", next.map((b, i) => bannerToRow(b, i))); } catch (e) { console.error("Erro ao salvar banners:", e); }
  }, []);
  const persistSettings = useCallback(async (next) => {
    setSettings(next);
    try {
      const { error } = await supabase.from("settings").upsert({ id: 1, order_email: next.orderEmail, order_whatsapp: next.orderWhatsapp, categories: next.categories || DEFAULT_CATEGORIES, colors: next.colors || [], fiscal_emitente: next.fiscalEmitente || {}, category_groups: next.categoryGroups || {} });
      if (error) throw error;
    } catch (e) { console.error("Erro ao salvar configurações:", e); }
  }, []);
  // Se o nome da cor ainda não estiver no catálogo reutilizável (comparando
  // sem diferenciar maiúsculas/minúsculas), adiciona ela — assim, na próxima
  // vez (lançar corte ou cadastro direto), ela já aparece pronta pra
  // escolher, sem digitar o nome nem escolher o tom de novo.
  async function garantirCorNoCatalogo(name, hex) {
    const nomeLimpo = (name || "").trim().toUpperCase();
    if (!nomeLimpo) return;
    const existe = (settings.colors || []).some((c) => c.name.toUpperCase() === nomeLimpo);
    if (existe) return;
    await persistSettings({ ...settings, colors: [...(settings.colors || []), { name: nomeLimpo, hex }] });
  }
  const persistClients = useCallback(async (next) => {
    const prev = clients;
    setClients(next);
    try { await diffSyncTable("clients", "id", prev, next, clientToRow); } catch (e) { console.error("Erro ao salvar clientes:", e); }
  }, [clients]);
  const persistOrders = useCallback(async (next) => {
    const prev = orders;
    setOrders(next);
    try { await diffSyncTable("orders", "id", prev, next, orderToRow); } catch (e) { console.error("Erro ao salvar pedidos:", e); }
  }, [orders]);
function stockItemToRow(si) {
  return { id: si.id, product_id: si.productId, variant_id: si.variantId, model: si.model, sku: si.sku,
    color: si.color, hex: si.hex, size: si.size, seq: si.seq, order_id: si.orderId || null,
    confirmed: si.confirmed !== false, confirmed_at: si.confirmedAt || null, cut_batch_id: si.cutBatchId || null };
}
function rowToStockItem(r) {
  return { id: r.id, productId: r.product_id, variantId: r.variant_id, model: r.model, sku: r.sku,
    color: r.color, hex: r.hex, size: r.size, seq: r.seq, orderId: r.order_id,
    confirmed: r.confirmed !== false, confirmedAt: r.confirmed_at, cutBatchId: r.cut_batch_id };
}

  const persistStockItems = useCallback(async (next) => {
    const prev = stockItems;
    setStockItems(next);
    try { await diffSyncTable("stock_items", "id", prev, next, stockItemToRow); } catch (e) { console.error("Erro ao salvar itens de estoque:", e); }
  }, [stockItems]);
  const persistCutBatches = useCallback(async (next) => {
    const prev = cutBatches;
    setCutBatches(next);
    try { await diffSyncTable("cut_batches", "id", prev, next, cutBatchToRow); } catch (e) { console.error("Erro ao salvar cortes:", e); }
  }, [cutBatches]);

  // Funcionário lança um corte: fica pendente até admin/admincentral aprovar
  // — não soma em nenhum estoque ainda, é só um registro aguardando revisão.
  // Garante que existe o produto/cor pra registrar o corte: se já veio um
  // modelo e cor existentes, só devolve eles; se for cor nova num modelo
  // existente, ou um modelo totalmente novo, já cria no catálogo — mas com
  // estoque de pronta entrega zerado, já que a peça ainda não foi costurada.
  async function garantirProdutoVariante({ productId, model, sku, category, description, price, costPrice, variantId, color, hex, images }) {
    const zeroStock = { P: 0, M: 0, G: 0, GG: 0 };
    if (productId && variantId) {
      const product = products.find((p) => p.id === productId);
      const variant = product?.variants.find((v) => v.id === variantId);
      if (images && JSON.stringify(images) !== JSON.stringify(variant?.images || [])) {
        const nextVariants = product.variants.map((v) => v.id === variantId ? { ...v, images } : v);
        const nextProduct = { ...product, variants: nextVariants };
        await persistProducts(products.map((p) => p.id === productId ? nextProduct : p));
        return { product: nextProduct, variant: nextVariants.find((v) => v.id === variantId) };
      }
      return { product, variant };
    }
    if (productId) {
      const product = products.find((p) => p.id === productId);
      const newVariant = { id: uid("v_"), color, hex, images: images || [], stock: { ...zeroStock } };
      const nextProduct = { ...product, variants: [...product.variants, newVariant] };
      await persistProducts(products.map((p) => p.id === productId ? nextProduct : p));
      return { product: nextProduct, variant: newVariant };
    }
    const newVariant = { id: uid("v_"), color, hex, images: images || [], stock: { ...zeroStock } };
    const newProduct = { id: uid("p_"), model, sku, category, description, price, costPrice, variants: [newVariant], nextItemSeq: 1 };
    await persistProducts([newProduct, ...products]);
    return { product: newProduct, variant: newVariant };
  }

  // Aceita uma ou várias cores de uma vez (colorResults: [{product, variant,
  // sizeQtyMap}, ...]) e grava tudo numa única chamada — chamar
  // persistCutBatches várias vezes em sequência rápida (uma por cor) fazia a
  // última sobrescrever a primeira, já que cada chamada partia do mesmo
  // cutBatches (ainda não atualizado pela chamada anterior).
  function lancarCorte(colorResults) {
    const entries = Array.isArray(colorResults) ? colorResults : [colorResults];
    const now = new Date().toISOString();
    const allBatches = [];
    const resultados = entries.map(({ product, variant, sizeQtyMap }) => {
      const batches = Object.entries(sizeQtyMap)
        .filter(([, qty]) => qty > 0)
        .map(([size, qty]) => ({
          id: uid("cb_"), productId: product.id, variantId: variant.id, model: product.model, color: variant.color,
          size, qty, cutBy: session.name || session.username, cutAt: now, status: "pendente",
        }));
      allBatches.push(...batches);
      return { product, variant, batches };
    });
    if (allBatches.length) persistCutBatches([...cutBatches, ...allBatches]);
    return resultados;
  }

  // Admin aprova um corte pendente: marca aprovado e soma a quantidade na
  // Programação do produto (estoque separado da pronta entrega), com
  // previsão de 30 dias a partir da data do corte.
  async function aprovarCorte(batchId) {
    const batch = cutBatches.find((b) => b.id === batchId);
    if (!batch || batch.status !== "pendente") return;
    const expected = new Date(batch.cutAt); expected.setDate(expected.getDate() + 30);
    const product = products.find((p) => p.id === batch.productId);
    const variant = product?.variants.find((v) => v.id === batch.variantId);
    let seq = product?.nextItemSeq || 1;
    // Cada peça já nasce com um código único e sequencial (o mesmo padrão da
    // Listagem de itens), em vez de um código genérico por cor/tamanho —
    // isso evita colisão entre cores com nomes parecidos (ex.: "Verde" e
    // "Vermelho" davam o mesmo código de 3 letras) e permite detectar se a
    // mesma peça for bipada duas vezes em "Receber estoque".
    const newItems = [];
    for (let i = 0; i < batch.qty; i++) {
      newItems.push({
        id: uid("si_"), productId: batch.productId, variantId: batch.variantId, model: batch.model,
        sku: shortSkuFor(product?.sku, batch.model), color: batch.color, hex: variant?.hex, size: batch.size,
        seq: seq++, orderId: null, confirmed: false, cutBatchId: batch.id,
      });
    }
    const nextProducts = products.map((p) => p.id !== batch.productId ? p : {
      ...p,
      nextItemSeq: seq,
      variants: p.variants.map((v) => v.id !== batch.variantId ? v : {
        ...v,
        stockProducao: { ...(v.stockProducao || {}), [batch.size]: (v.stockProducao?.[batch.size] || 0) + batch.qty },
        producaoDate: { ...(v.producaoDate || {}), [batch.size]: expected.toISOString() },
      }),
    });
    await persistProducts(nextProducts);
    await persistStockItems([...stockItems, ...newItems]);
    await persistCutBatches(cutBatches.map((b) => b.id === batchId ? { ...b, status: "aprovado", approvedBy: session.name || session.username, approvedAt: new Date().toISOString() } : b));
  }

  async function rejeitarCorte(batchId) {
    await persistCutBatches(cutBatches.map((b) => b.id === batchId ? { ...b, status: "rejeitado", approvedBy: session.name || session.username, approvedAt: new Date().toISOString() } : b));
  }

  // Exclui um corte lançado (pendente, aprovado ou recusado). Se já tinha
  // sido aprovado, desfaz os efeitos: tira a quantidade de "em produção" e
  // apaga as peças numeradas que nasceram dele — mas só se nenhuma delas já
  // tiver sido recebida ou vendida, pra nunca apagar peça real por engano.
  // Exclui um ou vários cortes lançados DE UMA VEZ (mesmo cuidado que já
  // tomamos em outros lugares: processar tudo junto, numa única gravação,
  // evita a corrida de chamar isso várias vezes em sequência rápida e uma
  // pisar na outra). Não apaga o registro do corte — só marca como
  // "excluído" (continua aparecendo no histórico), zera a quantidade dele
  // em produção, apaga as peças numeradas que ainda não foram recebidas
  // (essas nunca existiram de verdade), e remove a cor do produto se ela
  // ficar com zero peças em todo lugar. Peças já recebidas ou vendidas
  // nunca são tocadas.
  async function excluirCortes(batchIds) {
    const idsSet = new Set(batchIds);
    const alvos = cutBatches.filter((b) => idsSet.has(b.id) && b.status !== "excluído");
    if (!alvos.length) return { ok: true, bloqueados: [] };

    let nextProducts = products;
    let nextStockItems = stockItems;
    const bloqueados = [];

    for (const batch of alvos) {
      if (batch.status !== "aprovado") continue; // pendente/recusado não mexeu em estoque nenhum
      const product = nextProducts.find((p) => p.id === batch.productId);
      if (!product) continue;
      const ligadas = nextStockItems.filter((si) => si.cutBatchId === batch.id);
      const aindaNaoConfirmadas = ligadas.filter((si) => !si.confirmed);
      const qtyRemover = ligadas.length ? aindaNaoConfirmadas.length : batch.qty; // cortes antigos sem peça rastreada usam o qty do lote

      nextProducts = nextProducts.map((p) => p.id !== batch.productId ? p : {
        ...p,
        variants: p.variants.map((v) => v.id !== batch.variantId ? v : {
          ...v,
          stockProducao: { ...(v.stockProducao || {}), [batch.size]: Math.max(0, (v.stockProducao?.[batch.size] || 0) - qtyRemover) },
        }),
      });
      if (aindaNaoConfirmadas.length) {
        const removerIds = new Set(aindaNaoConfirmadas.map((si) => si.id));
        nextStockItems = nextStockItems.filter((si) => !removerIds.has(si.id));
      }
      const jaMexidas = ligadas.length - aindaNaoConfirmadas.length;
      if (jaMexidas > 0) bloqueados.push(`${batch.model} · ${batch.color} · ${batch.size}: ${jaMexidas} peça(s) já recebida(s)/vendida(s) continuam no estoque normalmente.`);
    }

    // Some com a cor da vitrine se ela ficou zerada em tudo (pronta +
    // produção, todos os tamanhos).
    nextProducts = nextProducts.map((p) => ({
      ...p,
      variants: p.variants.filter((v) => {
        const totalPronta = SIZES.reduce((a, s) => a + (v.stock?.[s] || 0), 0);
        const totalProducao = SIZES.reduce((a, s) => a + (v.stockProducao?.[s] || 0), 0);
        return totalPronta > 0 || totalProducao > 0;
      }),
    }));

    if (nextProducts !== products) await persistProducts(nextProducts);
    if (nextStockItems !== stockItems) await persistStockItems(nextStockItems);
    const now = new Date().toISOString();
    await persistCutBatches(cutBatches.map((b) => idsSet.has(b.id) ? { ...b, status: "excluído", approvedBy: session.name || session.username, approvedAt: now } : b));
    return { ok: true, bloqueados };
  }

  // Ajusta o estoque de uma leva de itens de pedido. sign=+1 devolve estoque
  // (cancelamento), sign=-1 abate de novo (pedido reativado a partir de
  // "Pedido cancelado"). Pedidos criados antes desta atualização não têm
  // productId/variantId guardado — nesse caso, tenta casar por modelo + cor;
  // se não achar correspondência, esse item é ignorado silenciosamente.
  function adjustStockForOrderItems(items, sign) {
    let nextProducts = products;
    items.forEach((it) => {
      let productId = it.productId, variantId = it.variantId;
      if (!productId || !variantId) {
        const prod = nextProducts.find((p) => p.model === it.model);
        const variant = prod?.variants.find((v) => v.color === it.color);
        if (!prod || !variant) return;
        productId = prod.id; variantId = variant.id;
      }
      nextProducts = nextProducts.map((p) => p.id !== productId ? p : {
        ...p,
        variants: p.variants.map((v) => v.id !== variantId ? v : { ...v, stock: { ...v.stock, [it.size]: Math.max(0, (v.stock?.[it.size] || 0) + sign * it.qty) } }),
      });
    });
    if (nextProducts !== products) persistProducts(nextProducts);
  }

  // Bipar uma peça em "Receber estoque": soma +1 no estoque daquele
  // tamanho/cor e já cria a peça numerada correspondente (mesma lógica de
  // rastreio da Listagem de itens), pra manter tudo consistente.
  // Bipar uma peça em "Receber estoque": se aquele tamanho/cor tem
  // quantidade "Em produção" (corte já aprovado, mas ainda sendo costurado),
  // essa bipada CONFIRMA que a peça ficou pronta — tira 1 de "Em produção"
  // e soma 1 em "Pronta entrega" (transferência). Se não tinha nada em
  // produção esperando, soma direto em "Pronta entrega" (fluxo antigo,
  // continua funcionando pra reposição normal sem passar pelo corte).
  // Acha, entre os pedidos ativos, o mais antigo que tem um item "em
  // produção" (vendido antes da peça existir fisicamente) desse mesmo
  // produto/cor/tamanho e que ainda não recebeu peça física suficiente pra
  // cobrir a quantidade comprada — usado pra saber se uma peça recém-pronta
  // precisa ir pro pedido de quem já comprou, em vez de virar estoque livre.
  function findPendingProducaoOrder(productId, variantId, size) {
    const ativos = orders
      .filter((o) => o.status !== "Pedido completo" && o.status !== "Pedido cancelado")
      .filter((o) => (o.items || []).some((it) => it.stockType === "producao" && it.productId === productId && it.variantId === variantId && it.size === size))
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    for (const o of ativos) {
      const item = o.items.find((it) => it.stockType === "producao" && it.productId === productId && it.variantId === variantId && it.size === size);
      const jaLigadas = stockItems.filter((si) => si.orderId === o.id && si.productId === productId && si.variantId === variantId && si.size === size).length;
      if (jaLigadas < item.qty) return o;
    }
    return null;
  }

  function scanReceiveStock(code) {
    const raw = (code || "").trim().toUpperCase();
    if (!raw) return { ok: false, message: "Código não reconhecido." };
    // Guarda o estado de antes pra poder desfazer esse bipe específico depois
    // (um "desfazer" simples: volta exatamente pro que estava antes).
    const prevProducts = products;
    const prevStockItems = stockItems;

    // Primeiro, tenta achar uma peça já rastreada individualmente (nascida
    // na aprovação de um corte, ou de uma bipada anterior) por esse código
    // exato — isso é o que permite detectar se a mesma peça física está
    // sendo bipada de novo por engano.
    const dotMatch = raw.match(/^(.+)\.(\d+)$/);
    if (dotMatch) {
      const existing = stockItems.find((si) => `${(si.sku || "").toUpperCase()}.${si.seq}` === raw);
      if (existing) {
        if (existing.confirmed) {
          return { ok: false, alreadyReceived: true, message: `${raw} já foi recebida em ${existing.confirmedAt ? new Date(existing.confirmedAt).toLocaleString("pt-BR") : "uma bipada anterior"}. Não foi contada de novo.` };
        }
        const product = products.find((p) => p.id === existing.productId);
        const variant = product?.variants.find((v) => v.id === existing.variantId);
        if (!product || !variant) return { ok: false, message: "Produto não encontrado." };
        const producaoAtual = variant.stockProducao?.[existing.size] || 0;
        const pedidoReservando = findPendingProducaoOrder(existing.productId, existing.variantId, existing.size);

        if (pedidoReservando) {
          // Essa peça já tem dono — foi vendida como "em produção" antes de
          // existir de verdade. Sai de produção, mas NÃO entra em pronta
          // entrega (não fica disponível pra outra venda): já nasce ligada
          // ao pedido de quem comprou.
          const nextProducts = products.map((p) => p.id !== product.id ? p : {
            ...p,
            variants: p.variants.map((v) => v.id !== variant.id ? v : {
              ...v,
              stockProducao: { ...v.stockProducao, [existing.size]: Math.max(0, producaoAtual - 1) },
            }),
          });
          persistProducts(nextProducts);
          persistStockItems(stockItems.map((si) => si.id === existing.id ? { ...si, confirmed: true, confirmedAt: new Date().toISOString(), orderId: pedidoReservando.id } : si));
          return { ok: true, reservedForOrder: true, message: `${product.model} · ${variant.color} · ${existing.size} — peça já vendida! Vai para o pedido de ${pedidoReservando.clientName} (não entrou em pronta entrega).`, undo: () => { persistProducts(prevProducts); persistStockItems(prevStockItems); } };
        }

        const newStock = (variant.stock?.[existing.size] || 0) + 1;
        const nextProducts = products.map((p) => p.id !== product.id ? p : {
          ...p,
          variants: p.variants.map((v) => v.id !== variant.id ? v : {
            ...v,
            stock: { ...v.stock, [existing.size]: newStock },
            stockProducao: { ...v.stockProducao, [existing.size]: Math.max(0, producaoAtual - 1) },
          }),
        });
        persistProducts(nextProducts);
        persistStockItems(stockItems.map((si) => si.id === existing.id ? { ...si, confirmed: true, confirmedAt: new Date().toISOString() } : si));
        return { ok: true, message: `${product.model} · ${variant.color} · ${existing.size} (confirmado da produção) — pronta entrega agora: ${newStock}`, undo: () => { persistProducts(prevProducts); persistStockItems(prevStockItems); } };
      }
    }

    // Se não é uma peça já rastreada, cai no formato antigo em lote
    // (SKU-COR-TAM) — reposição direta, sem ter passado por corte/aprovação.
    const match = matchScannedCode(code, products, stockItems);
    if (!match) return { ok: false, message: "Código não reconhecido." };
    const product = products.find((p) => p.id === match.productId);
    const variant = product?.variants.find((v) => v.id === match.variantId);
    if (!product || !variant) return { ok: false, message: "Produto não encontrado." };
    const seq = product.nextItemSeq || 1;
    const emProducao = variant.stockProducao?.[match.size] || 0;
    const veioDaProducao = emProducao > 0;
    const newStock = (variant.stock?.[match.size] || 0) + 1;
    const nextProducts = products.map((p) => p.id !== product.id ? p : {
      ...p,
      nextItemSeq: seq + 1,
      variants: p.variants.map((v) => v.id !== variant.id ? v : {
        ...v,
        stock: { ...v.stock, [match.size]: newStock },
        stockProducao: veioDaProducao ? { ...v.stockProducao, [match.size]: emProducao - 1 } : v.stockProducao,
      }),
    });
    persistProducts(nextProducts);
    persistStockItems([...stockItems, {
      id: uid("si_"), productId: product.id, variantId: variant.id, model: product.model,
      sku: shortSkuFor(product.sku, product.model), color: variant.color, hex: variant.hex, size: match.size,
      seq, orderId: null, confirmed: true, confirmedAt: new Date().toISOString(),
    }]);
    return { ok: true, message: `${product.model} · ${variant.color} · ${match.size}${veioDaProducao ? " (confirmado da produção)" : ""} — pronta entrega agora: ${newStock}`, undo: () => { persistProducts(prevProducts); persistStockItems(prevStockItems); } };
  }

  // Bipar uma peça em "Coletar pedido": confere se ela pertence ao pedido
  // que está sendo separado e soma na contagem daquele item, sem mexer no
  // estoque de novo (o abate já aconteceu quando o pedido foi finalizado).
  function scanCollectOrder(order, code) {
    const raw = (code || "").trim().toUpperCase();
    const prevOrders = orders;
    // Se o código bipado é de uma peça individual rastreada, confere se ela
    // já passou por "Receber estoque" — uma etiqueta impressa de uma peça
    // ainda em produção não pode ser aceita aqui como se já estivesse pronta.
    const dotMatch = raw.match(/^(.+)\.(\d+)$/);
    let specificItem = null;
    if (dotMatch) {
      specificItem = stockItems.find((si) => `${(si.sku || "").toUpperCase()}.${si.seq}` === raw);
      if (specificItem && specificItem.confirmed === false) {
        return { ok: false, message: `${raw} ainda está em produção — confirme em "Receber estoque" antes de coletar.` };
      }
    }
    const match = matchScannedCode(code, products, stockItems);
    if (!match) return { ok: false, message: "Código não reconhecido." };
    const idx = order.items.findIndex((it) => it.productId === match.productId && it.variantId === match.variantId && it.size === match.size);
    if (idx === -1) return { ok: false, message: "Essa peça não faz parte deste pedido." };
    const item = order.items[idx];
    const collected = item.collected || 0;
    const collectedIds = item.collectedIds || [];
    // Mesma peça física bipada duas vezes nunca deve contar duas vezes.
    if (specificItem && collectedIds.includes(specificItem.id)) {
      return { ok: false, duplicatePiece: true, message: `${raw} já foi coletada neste pedido. Não foi contada de novo.` };
    }
    if (collected >= item.qty) return { ok: false, alreadyComplete: true, message: `"${item.model}" (${item.color}, ${item.size}) já está completo.` };
    const nextItems = order.items.map((it, i) => i === idx ? { ...it, collected: collected + 1, collectedIds: specificItem ? [...(it.collectedIds || []), specificItem.id] : it.collectedIds } : it);
    persistOrders(orders.map((o) => o.id === order.id ? { ...o, items: nextItems } : o));
    return { ok: true, message: `${item.model} · ${item.color} · ${item.size} — ${collected + 1} de ${item.qty}`, undo: () => persistOrders(prevOrders) };
  }

  function updateOrderStatus(orderId, newStatus, extra) {
    const order = orders.find((o) => o.id === orderId);
    if (!order) return;
    if (order.status === "Pedido cancelado") return; // trava: pedido cancelado não pode mudar de status novamente
    if (newStatus === "Pedido cancelado") {
      const qtdItens = order.items.reduce((a, it) => a + it.qty, 0);
      const confirmed = confirm(`Cancelar o pedido de "${order.clientName}"? ${qtdItens} peça(s) vão voltar para o estoque. Depois de cancelado, este pedido não poderá mais ser reativado.`);
      if (!confirmed) return;
      adjustStockForOrderItems(order.items, +1);
      // Libera de volta ao estoque os itens individuais (numerados) que
      // tinham sido marcados como vendidos neste pedido.
      if (stockItems.some((si) => si.orderId === orderId)) {
        persistStockItems(stockItems.map((si) => si.orderId === orderId ? { ...si, orderId: null } : si));
      }
    }
    const next = orders.map((o) => o.id === orderId
      ? { ...o, ...extra, status: newStatus, statusLog: [...(o.statusLog || []), { status: newStatus, by: session.name || session.username, when: new Date().toISOString() }] }
      : o);
    persistOrders(next);
  }

  // Copia os itens de um pedido existente para um novo pedido, atribuído a
  // outro cliente. É um pedido novo de verdade: abate estoque normalmente e
  // respeita a disponibilidade — se faltar estoque para algum item, a
  // quantidade copiada é reduzida ao que houver disponível (avisando o
  // usuário), e itens sem nenhum estoque disponível são deixados de fora.
  // Copia os itens de um pedido existente para o CARRINHO (não cria o pedido
  // direto), atribuído a outro cliente, para revisão antes de finalizar.
  // Se o carrinho já tiver itens, avisa que serão substituídos. Cada item
  // copiado reserva o quanto houver disponível agora — se a quantidade do
  // pedido original for maior que o estoque atual, o item entra "incompleto"
  // (qty > reserved); a tela do carrinho mostra esses itens em vermelho, e
  // só libera "Finalizar pedido" quando o usuário reduzir a quantidade até
  // bater com o que está reservado (ou remover o item).
  // Copia os itens de um pedido existente para o CARRINHO (não cria o pedido
  // direto), atribuído a outro cliente, para revisão antes de finalizar. Se o
  // carrinho já tiver itens, avisa que serão substituídos. Como o estoque só é
  // abatido na finalização (ver finalizeOrder), aqui não precisa reservar nada.
  function copyOrderToCart(order, client) {
    if (!order || !order.items || !order.items.length) {
      alert("Não foi possível copiar: este pedido não tem itens.");
      return;
    }
    if (cart.length) {
      const proceed = confirm("Você já tem itens no carrinho. Copiar este pedido vai substituir o que está lá agora pelos itens da cópia. Deseja continuar?");
      if (!proceed) return;
    }
    const newCartItems = order.items.map((it) => {
      let productId = it.productId, variantId = it.variantId;
      if (!productId || !variantId) {
        const prod = products.find((p) => p.model === it.model);
        const variant = prod?.variants.find((v) => v.color === it.color);
        if (prod && variant) { productId = prod.id; variantId = variant.id; }
      }
      const liveProduct = products.find((p) => p.id === productId);
      const liveVariant = liveProduct?.variants.find((v) => v.id === variantId);
      return {
        cartItemId: uid(`cp_${it.size}_`), productId, variantId,
        model: it.model, category: it.category, price: it.price,
        color: it.color, hex: liveVariant?.hex || "#DCD2BE", size: it.size,
        qty: it.qty, image: it.image || null,
      };
    });
    persistCart(newCartItems);
    setSelectedClient(client);
    setCartOpen(true);
  }

  async function handleLogin(username) {
    let finalUsers;
    try {
      finalUsers = await loadAppData();
    } catch (e) {
      console.error("Erro ao carregar dados após login:", e);
      alert("Login feito, mas não consegui carregar os dados do sistema agora. Tente recarregar a página e entrar de novo.");
      await supabase.auth.signOut();
      return;
    }
    if (!finalUsers[username]) {
      alert("Login feito, mas não consegui confirmar seu papel de acesso agora (provavelmente uma falha momentânea de conexão). Recarregue a página e tente entrar de novo.");
      await supabase.auth.signOut();
      return;
    }
    const u = { username, ...finalUsers[username] };
    setSession(u);
    setSelectedClient(null);
    const { data: cartRow } = await withRetry(() => supabase.from("carts").select("items").eq("username", username).maybeSingle());
    setCart(cartRow?.items || []);
  }
  function handleLogout() {
    supabase.auth.signOut();
    setSession(null); setScreen("catalog"); setCart([]); setCartOpen(false); setSelectedClient(null);
  }

  const persistCart = useCallback(async (next) => {
    setCart(next);
    if (session) {
      try {
        const { error } = await supabase.from("carts").upsert({ username: session.username, items: next, updated_at: new Date().toISOString() });
        if (error) throw error;
      } catch (e) { console.error("Erro ao salvar carrinho:", e); }
    }
  }, [session]);

  // Modelo de estoque: adicionar, remover ou ajustar a quantidade de um item
  // no carrinho NÃO mexe no estoque — o item continua disponível para todos
  // os logins normalmente. O abate de verdade só acontece ao finalizar o
  // pedido (ver finalizeOrder), que é também onde a disponibilidade é
  // conferida uma última vez antes de confirmar a venda.
  function addToCart(product, variant, items) {
    let nextCart = cart;
    items.forEach(({ size, qty }) => {
      if (qty <= 0) return;
      const cartItemId = `${product.id}__${variant.id}__${size}`;
      const existing = nextCart.find((c) => c.cartItemId === cartItemId);
      if (existing) {
        nextCart = nextCart.map((c) => c.cartItemId === cartItemId ? { ...c, qty: c.qty + qty } : c);
      } else {
        nextCart = [...nextCart, {
          cartItemId, productId: product.id, variantId: variant.id, model: product.model, category: product.category, price: product.price,
          color: variant.color, hex: variant.hex, size, qty,
          image: variant.images[0] || null,
        }];
      }
    });
    persistCart(nextCart);
    setCartOpen(true);
  }
  function updateCartQty(cartItemId, qty) {
    persistCart(cart.map((c) => c.cartItemId === cartItemId ? { ...c, qty: Math.max(1, qty) } : c));
  }
  // Define a quantidade de um tamanho específico no carrinho (não soma em
  // cima do que já tem) — usado pelo card do produto, que agora mostra e
  // edita a quantidade que já está no carrinho, em vez de sempre partir de 0.
  // Aplica várias mudanças de quantidade (uma por tamanho) de uma vez só,
  // partindo do MESMO carrinho atual — evita a corrida de antes, onde
  // gravar um tamanho de cada vez fazia cada gravação "esquecer" a anterior.
  function commitCartChanges(product, variant, sizeQtyMap, stockType = "pronta") {
    let nextCart = cart;
    Object.entries(sizeQtyMap).forEach(([size, qty]) => {
      const cartItemId = `${product.id}__${variant.id}__${size}__${stockType}`;
      const idx = nextCart.findIndex((c) => c.cartItemId === cartItemId);
      if (qty <= 0) {
        if (idx !== -1) nextCart = nextCart.filter((c) => c.cartItemId !== cartItemId);
      } else if (idx !== -1) {
        nextCart = nextCart.map((c, i) => i === idx ? { ...c, qty: Math.max(1, qty) } : c);
      } else {
        nextCart = [...nextCart, {
          cartItemId, productId: product.id, variantId: variant.id, model: product.model, category: product.category, price: product.price,
          color: variant.color, hex: variant.hex, size, qty, image: variant.images[0] || null, stockType,
        }];
      }
    });
    persistCart(nextCart);
    setCartOpen(true);
  }
  function removeCartItem(cartItemId) { persistCart(cart.filter((c) => c.cartItemId !== cartItemId)); }
  function clearCart() { persistCart([]); setSelectedClient(null); }

  async function finalizeOrder(note) {
    if (!cart.length || !session) return;
    // Confere a disponibilidade agora mesmo, pro aviso ser rápido — o abate
    // de verdade acontece no servidor (função finalize-order), que confere
    // tudo de novo antes de gravar, então essa checagem aqui é só uma
    // resposta rápida pro usuário, não a garantia final.
    const insufficientItem = cart.find((c) => {
      const liveProduct = products.find((p) => p.id === c.productId);
      const liveVariant = liveProduct?.variants.find((v) => v.id === c.variantId);
      const bucket = c.stockType === "producao" ? liveVariant?.stockProducao : liveVariant?.stock;
      const available = bucket?.[c.size] || 0;
      return c.qty > available;
    });
    if (insufficientItem) {
      alert("Ainda há itens com estoque insuficiente (em vermelho). Ajuste a quantidade ou remova esses itens antes de finalizar.");
      return;
    }

    const items = cart.map((c) => {
      const prod = products.find((p) => p.id === c.productId);
      return { model: c.model, category: c.category, color: c.color, size: c.size, qty: c.qty, price: parseBRL(c.price), costPrice: prod ? parseBRL(prod.costPrice) : 0, image: c.image || null, sku: prod?.sku || "", productId: c.productId, variantId: c.variantId, stockType: c.stockType || "pronta" };
    });
    const { data, error } = await withRetry(() => supabase.functions.invoke("finalize-order", {
      body: { clientName: selectedClient?.buyerName || session.name || session.username, items, note: note || "" },
    }));
    if (error || data?.error) {
      if (data?.shortages?.length) {
        alert("O estoque mudou enquanto você revisava o carrinho (outra pessoa deve ter finalizado um pedido igual). Recarregue a página e ajuste as quantidades.");
      } else {
        alert(data?.error || "Não foi possível finalizar o pedido agora. Tente novamente.");
      }
      return;
    }

    // O abate de estoque e a marcação das peças vendidas já aconteceram no
    // servidor — recarrega os dados pra refletir isso na tela.
    await loadAppData();
    // Encerra a ação de estar no carrinho: esvazia o carrinho e o cliente
    // selecionado, já que o pedido acabou de ser liberado para a aba Pedidos.
    persistCart([]);
    setSelectedClient(null);
  }

  if (!booted) {
    return <div style={{ background: TOKENS.ink, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: TOKENS.sand, fontFamily: "system-ui" }}>Carregando catálogo…</div>;
  }
  if (!session) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  const showPrice = session.role === "admin" || session.role === "admincentral" || session.role === "representante" || session.access === "atacado";
  const needsClientSelect = session.role === "admin" || session.role === "admincentral" || session.role === "representante";
  const isStaff = session.role === "admin" || session.role === "admincentral";
  const clientsForCart = session.role === "representante" ? clients.filter((c) => c.repUsername === session.username) : clients;

  return (
    <div style={{ minHeight: "100vh", background: TOKENS.ivory, fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <TopBar session={session} screen={screen} setScreen={setScreen} onLogout={handleLogout} cartCount={cart.reduce((a, c) => a + c.qty, 0)} onOpenCart={() => setCartOpen(true)} />
      {screen === "admin" && (session.role === "admin" || session.role === "admincentral") ? (
        <AdminPanel users={users} setUsers={persistUsers} products={products} setProducts={persistProducts} banners={banners} setBanners={persistBanners} settings={settings} setSettings={persistSettings} clients={clients} setClients={persistClients} orders={orders} updateStatus={updateOrderStatus} onCopyOrder={copyOrderToCart} stockItems={stockItems} setStockItems={persistStockItems} scanReceiveStock={scanReceiveStock} scanCollectOrder={scanCollectOrder} session={session} cutBatches={cutBatches} persistCutBatches={persistCutBatches} lancarCorte={lancarCorte} garantirProdutoVariante={garantirProdutoVariante} persistProducts={persistProducts} aprovarCorte={aprovarCorte} rejeitarCorte={rejeitarCorte} excluirCortes={excluirCortes} garantirCorNoCatalogo={garantirCorNoCatalogo} />
      ) : screen === "central" && session.role === "admincentral" ? (
        <AdminCentralPanel users={users} setUsers={persistUsers} products={products} setProducts={persistProducts} orders={orders} updateStatus={updateOrderStatus} clients={clients} onCopyOrder={copyOrderToCart} />
      ) : screen === "rep-clients" && session.role === "representante" ? (
        <RepClientsPanel clients={clients} setClients={persistClients} session={session} />
      ) : screen === "rep-pedidos" && session.role === "representante" ? (
        <PedidosAdmin orders={orders} updateStatus={updateOrderStatus} scopeUsername={session.username} readOnly clients={clientsForCart} onCopyOrder={copyOrderToCart} />
      ) : (
        <CatalogView products={products} banners={banners} session={session} addToCart={addToCart} cart={cart} commitCartChanges={commitCartChanges} categories={settings.categories || DEFAULT_CATEGORIES} categoryGroups={settings.categoryGroups || {}} />
      )}
      {cartOpen && (
        <CartDrawer
          cart={cart} products={products} onClose={() => setCartOpen(false)} showPrice={showPrice}
          updateCartQty={updateCartQty} removeCartItem={removeCartItem} clearCart={clearCart}
          settings={settings} session={session}
          clients={clientsForCart} needsClientSelect={needsClientSelect}
          selectedClient={selectedClient} setSelectedClient={setSelectedClient}
          onFinalizeOrder={finalizeOrder}
        />
      )}
      <PrintableOrder cart={cart} showPrice={showPrice} session={session} client={selectedClient} />
    </div>
  );
}

/* ---------------- LOGIN ---------------- */
function LoginScreen({ onLogin }) {
  const [username, setUsername] = useState(() => localStorage.getItem("mallo_saved_user") || "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const captchaRef = useRef(null);
  const widgetIdRef = useRef(null);

  // Limpa qualquer senha que tenha ficado salva em texto puro no navegador
  // de uma versão anterior do app.
  useEffect(() => { localStorage.removeItem("mallo_saved_pass"); }, []);

  // Carrega e desenha o captcha (Cloudflare Turnstile) assim que a tela abre.
  useEffect(() => {
    let cancelled = false;
    loadTurnstile().then((turnstile) => {
      if (cancelled || !captchaRef.current || widgetIdRef.current) return;
      widgetIdRef.current = turnstile.render(captchaRef.current, {
        sitekey: TURNSTILE_SITE_KEY,
        callback: (token) => setCaptchaToken(token),
        "expired-callback": () => setCaptchaToken(""),
        "error-callback": () => setCaptchaToken(""),
      });
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  function saveLogin() {
    localStorage.setItem("mallo_saved_user", username);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  // Todo login passa pelo Supabase Auth de verdade (senha criptografada).
  // O e-mail usado por baixo dos panos é calculado a partir do nome de
  // usuário digitado (usuario@mallo.internal) — não precisa ler o banco
  // antes de autenticar, o que é o que permite travar a leitura também.
  // O token do captcha (resolvido sem a pessoa precisar fazer nada, na
  // maioria dos casos) é enviado junto e validado pelo próprio Supabase.
  async function submit() {
    const key = username.trim().toLowerCase();
    if (!key || !password) { setError("Login ou senha inválidos."); return; }
    if (!captchaToken) { setError("Aguarde a verificação de segurança terminar e tente de novo."); return; }
    const email = AUTH_EMAIL_OVERRIDES[key] || `${key}@mallo.internal`;
    setLoading(true);
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password, options: { captchaToken } });
    setLoading(false);
    if (window.turnstile && widgetIdRef.current) window.turnstile.reset(widgetIdRef.current);
    setCaptchaToken("");
    if (authError) { setError("Login ou senha inválidos."); return; }
    setError(""); onLogin(key);
  }
  function onKeyDown(e) { if (e.key === "Enter") submit(); }

  return (
    <div style={{ minHeight: "100vh", background: TOKENS.ink, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "system-ui, -apple-system, sans-serif", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, backgroundImage: `repeating-linear-gradient(90deg, ${TOKENS.inkSoft} 0px, ${TOKENS.inkSoft} 1px, transparent 1px, transparent 120px)`, opacity: 0.5 }} />
      <div style={{ width: "100%", maxWidth: 400, position: "relative" }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontFamily: "Georgia, serif", fontSize: 13, letterSpacing: 4, color: TOKENS.sand, textTransform: "uppercase" }}>Showroom Digital</div>
          <div style={{ fontFamily: "Georgia, serif", fontSize: 34, color: TOKENS.ivory, marginTop: 6 }}>Catálogo B2B</div>
          <div style={{ width: 48, height: 1, background: TOKENS.sand, margin: "14px auto 0" }} />
        </div>
        <div style={{ background: TOKENS.inkSoft, border: `1px solid #35333a`, borderRadius: 4, padding: 28 }}>
          <label style={{ display: "block", fontSize: 11, letterSpacing: 1.5, color: TOKENS.sand, textTransform: "uppercase", marginBottom: 6 }}>Login</label>
          <div style={{ display: "flex", alignItems: "center", background: "#1F1E23", border: "1px solid #3A3843", borderRadius: 3, padding: "10px 12px", marginBottom: 16 }}>
            <User size={16} color={TOKENS.graphite} />
            <input value={username} onChange={(e) => setUsername(e.target.value)} onKeyDown={onKeyDown} placeholder="seu.login" style={{ background: "transparent", border: "none", outline: "none", color: TOKENS.ivory, marginLeft: 10, width: "100%", fontSize: 14 }} />
          </div>
          <label style={{ display: "block", fontSize: 11, letterSpacing: 1.5, color: TOKENS.sand, textTransform: "uppercase", marginBottom: 6 }}>Senha</label>
          <div style={{ display: "flex", alignItems: "center", background: "#1F1E23", border: "1px solid #3A3843", borderRadius: 3, padding: "10px 12px", marginBottom: 8 }}>
            <Lock size={16} color={TOKENS.graphite} />
            <input type={showPass ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={onKeyDown} placeholder="••••••••" style={{ background: "transparent", border: "none", outline: "none", color: TOKENS.ivory, marginLeft: 10, width: "100%", fontSize: 14 }} />
            <button onClick={() => setShowPass((s) => !s)} style={{ background: "none", border: "none", cursor: "pointer", color: TOKENS.graphite }}><Eye size={15} /></button>
          </div>
          {error && <div style={{ color: "#D98080", fontSize: 12.5, marginTop: 8 }}>{error}</div>}
          <div ref={captchaRef} style={{ marginTop: 12, display: "flex", justifyContent: "center" }} />
          <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
            <button onClick={submit} disabled={loading} style={{ flex: 1, background: TOKENS.wine, color: TOKENS.ivory, border: "none", borderRadius: 3, padding: "12px 0", fontSize: 13, letterSpacing: 1.5, textTransform: "uppercase", cursor: loading ? "default" : "pointer", opacity: loading ? 0.7 : 1 }}>{loading ? "Entrando..." : "Entrar"}</button>
            <button onClick={saveLogin} title="Salvar apenas o nome de usuário (a senha nunca é guardada, por segurança)" style={{ flex: 1, background: "transparent", color: saved ? TOKENS.sand : TOKENS.ivory, border: `1px solid ${TOKENS.sand}`, borderRadius: 3, padding: "12px 0", fontSize: 12, letterSpacing: 1, textTransform: "uppercase", cursor: "pointer" }}>{saved ? "Salvo ✓" : "Salvar login"}</button>
          </div>
          <div style={{ fontSize: 10.5, color: TOKENS.graphite, marginTop: 10, lineHeight: 1.4 }}>Login com senha criptografada — "Salvar login" guarda só o usuário, nunca a senha.</div>
        </div>
        <div style={{ textAlign: "center", color: TOKENS.graphite, fontSize: 11.5, marginTop: 16 }}>Acesso central, administrativo, de representantes e de clientes atacado — solicite ao seu representante.</div>
      </div>
    </div>
  );
}

/* ---------------- TOP BAR ---------------- */
function TopBar({ session, screen, setScreen, onLogout, cartCount, onOpenCart }) {
  const roleLabel = session.role === "admincentral" ? "Admin Central" : session.role === "admin" ? "Administrador" : session.role === "representante" ? "Representante" : session.access === "atacado" ? "Cliente · Atacado" : "Visualização · Fotos";
  const isStaff = session.role === "admin" || session.role === "admincentral";
  return (
    <div style={{ background: TOKENS.ink, color: TOKENS.ivory, padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 20, flexWrap: "wrap", gap: 10 }}>
      <div style={{ fontFamily: "Georgia, serif", fontSize: 19, letterSpacing: 0.5 }}>Catálogo B2B</div>
      <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
      
          {isStaff && (
  <div style={{ display: "flex", background: TOKENS.inkSoft, borderRadius: 3, padding: 3 }}>
    <button onClick={() => setScreen("catalog")} style={{ padding: "6px 14px", fontSize: 12.5, borderRadius: 2, border: "none", cursor: "pointer", background: screen === "catalog" ? TOKENS.wine : "transparent", color: TOKENS.ivory }}>Vitrine</button>
    {(session.role === "admin" || session.role === "admincentral") && (
      <button onClick={() => setScreen("admin")} style={{ padding: "6px 14px", fontSize: 12.5, borderRadius: 2, border: "none", cursor: "pointer", background: screen === "admin" ? TOKENS.wine : "transparent", color: TOKENS.ivory }}>Painel ADM</button>
    )}
    {session.role === "admincentral" && (
      <button onClick={() => setScreen("central")} style={{ padding: "6px 14px", fontSize: 12.5, borderRadius: 2, border: "none", cursor: "pointer", background: screen === "central" ? TOKENS.wine : "transparent", color: TOKENS.ivory, display: "flex", alignItems: "center", gap: 5 }}><Crown size={12} /> Painel Central</button>
    )}
  </div>
)}
        {session.role === "representante" && (
          <div style={{ display: "flex", background: TOKENS.inkSoft, borderRadius: 3, padding: 3 }}>
            <button onClick={() => setScreen("catalog")} style={{ padding: "6px 14px", fontSize: 12.5, borderRadius: 2, border: "none", cursor: "pointer", background: screen === "catalog" ? TOKENS.wine : "transparent", color: TOKENS.ivory }}>Vitrine</button>
            <button onClick={() => setScreen("rep-clients")} style={{ padding: "6px 14px", fontSize: 12.5, borderRadius: 2, border: "none", cursor: "pointer", background: screen === "rep-clients" ? TOKENS.wine : "transparent", color: TOKENS.ivory, display: "flex", alignItems: "center", gap: 5 }}><Building2 size={12} /> Clientes</button>
            <button onClick={() => setScreen("rep-pedidos")} style={{ padding: "6px 14px", fontSize: 12.5, borderRadius: 2, border: "none", cursor: "pointer", background: screen === "rep-pedidos" ? TOKENS.wine : "transparent", color: TOKENS.ivory, display: "flex", alignItems: "center", gap: 5 }}><Archive size={12} /> Pedidos</button>
          </div>
        )}
        {screen === "catalog" && (
          <button onClick={onOpenCart} style={{ position: "relative", background: "none", border: "none", color: TOKENS.ivory, cursor: "pointer", display: "flex" }}>
            <ShoppingCart size={19} />
            {cartCount > 0 && <span style={{ position: "absolute", top: -8, right: -9, background: TOKENS.wine, color: "#fff", borderRadius: "50%", fontSize: 10, width: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>{cartCount}</span>}
          </button>
        )}
        <div style={{ fontSize: 12.5, color: TOKENS.sand, textAlign: "right" }}>
          <div>{session.name || session.username}</div>
          <div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: 1 }}>{roleLabel}</div>
        </div>
        <button onClick={onLogout} title="Sair" style={{ background: "none", border: "none", color: TOKENS.sand, cursor: "pointer", display: "flex" }}><LogOut size={18} /></button>
      </div>
    </div>
  );
}

/* ---------------- CATALOG (client-facing) ---------------- */
function CatalogView({ products, banners, session, addToCart, cart, commitCartChanges, categories, categoryGroups }) {
  const showPrice = session.role === "admin" || session.role === "admincentral" || session.role === "representante" || session.access === "atacado";
  const [activeGroup, setActiveGroup] = useState("Todas");
  const [activeCat, setActiveCat] = useState("Todas");
  const [search, setSearch] = useState("");
  const searching = search.trim().length > 0;

  const searchResults = useMemo(() => {
    if (!searching) return [];
    const term = normalizeSearch(search);
    return products.filter((p) => normalizeSearch(p.model).includes(term) || normalizeSearch(p.sku).includes(term));
  }, [searching, search, products]);

  const presentCats = categories.filter((cat) => products.some((p) => p.category === cat));

  const groupOf = useMemo(() => {
    const map = {};
    Object.entries(categoryGroups || {}).forEach(([group, cats]) => (cats || []).forEach((cat) => { map[cat] = group; }));
    return map;
  }, [categoryGroups]);

  const groupNames = Object.keys(categoryGroups || {}).filter((g) => presentCats.some((cat) => groupOf[cat] === g));
  const ungroupedPresentCats = presentCats.filter((cat) => !groupOf[cat]);
  const hasOutras = ungroupedPresentCats.length > 0;

  const subcats = activeGroup === "Todas" ? presentCats
    : activeGroup === "__outras__" ? ungroupedPresentCats
    : presentCats.filter((cat) => groupOf[cat] === activeGroup);

  function selectGroup(g) { setActiveGroup(g); setActiveCat("Todas"); }

  const filtered = activeCat === "Todas" ? products.filter((p) => subcats.includes(p.category)) : products.filter((p) => p.category === activeCat);
  const grouped = activeCat === "Todas"
    ? subcats.map((cat) => ({ cat, items: products.filter((p) => p.category === cat) }))
    : [{ cat: activeCat, items: filtered }];

  return (
    <div>
      <BannerCarousel banners={banners} />
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "36px 24px 80px" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: 2, color: TOKENS.wine, textTransform: "uppercase" }}>Coleção</div>
            <div style={{ fontFamily: "Georgia, serif", fontSize: 28, color: TOKENS.ink }}>Catálogo de Modelos</div>
          </div>
          {!showPrice && <div style={{ fontSize: 12, color: TOKENS.graphite, fontStyle: "italic" }}>Preços disponíveis para login atacado</div>}
        </div>

        <div style={{ position: "relative", marginBottom: 20, maxWidth: 420 }}>
          <Search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: TOKENS.graphite }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome do modelo ou SKU..."
            style={{ ...inputStyle, paddingLeft: 36, paddingRight: search ? 34 : 12 }}
          />
          {search && (
            <button onClick={() => setSearch("")} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: TOKENS.graphite, display: "flex" }}>
              <X size={15} />
            </button>
          )}
        </div>

        {!searching && (
          <>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", paddingBottom: groupNames.length || hasOutras ? 10 : 16, marginBottom: groupNames.length || hasOutras ? 10 : 26, borderBottom: groupNames.length || hasOutras ? "none" : `1px solid ${TOKENS.line}` }}>
              <CategoryPill active={activeGroup === "Todas"} onClick={() => selectGroup("Todas")}>Todas</CategoryPill>
              {groupNames.map((g) => <CategoryPill key={g} active={activeGroup === g} onClick={() => selectGroup(g)}>{g}</CategoryPill>)}
              {hasOutras && <CategoryPill active={activeGroup === "__outras__"} onClick={() => selectGroup("__outras__")}>Outras</CategoryPill>}
            </div>

            {activeGroup !== "Todas" && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", borderBottom: `1px solid ${TOKENS.line}`, paddingBottom: 16, marginBottom: 26 }}>
                <CategoryPill active={activeCat === "Todas"} onClick={() => setActiveCat("Todas")}>Todas</CategoryPill>
                {subcats.map((cat) => <CategoryPill key={cat} active={activeCat === cat} onClick={() => setActiveCat(cat)}>{cat}</CategoryPill>)}
              </div>
            )}
          </>
        )}

        {searching ? (
          <>
            <div style={{ fontSize: 12.5, color: TOKENS.graphite, marginBottom: 16 }}>{searchResults.length} resultado{searchResults.length === 1 ? "" : "s"} para "{search}"</div>
            {searchResults.length === 0 ? (
              <div style={{ color: TOKENS.graphite, padding: 40, textAlign: "center" }}>Nenhum modelo encontrado com esse nome ou SKU.</div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: 22 }}>
                {searchResults.map((p) => <ProductCard key={p.id} p={p} showPrice={showPrice} addToCart={addToCart} cart={cart} commitCartChanges={commitCartChanges} />)}
              </div>
            )}
          </>
        ) : products.length === 0 ? (
          <div style={{ color: TOKENS.graphite, padding: 40, textAlign: "center" }}>Nenhum modelo cadastrado ainda.</div>
        ) : filtered.length === 0 ? (
          <div style={{ color: TOKENS.graphite, padding: 40, textAlign: "center" }}>Nenhum modelo nesta categoria ainda.</div>
        ) : (
          grouped.map(({ cat, items }) => items.length === 0 ? null : (
            <div key={cat} style={{ marginBottom: 34 }}>
              {activeCat === "Todas" && <div style={{ fontFamily: "Georgia, serif", fontSize: 19, color: TOKENS.ink, marginBottom: 14, borderLeft: `3px solid ${TOKENS.wine}`, paddingLeft: 10 }}>{cat}</div>}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: 22 }}>
                {items.map((p) => <ProductCard key={p.id} p={p} showPrice={showPrice} addToCart={addToCart} cart={cart} commitCartChanges={commitCartChanges} />)}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function CategoryPill({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{ padding: "7px 15px", borderRadius: 16, fontSize: 12.5, cursor: "pointer", border: `1px solid ${active ? TOKENS.wine : TOKENS.line}`, background: active ? TOKENS.wine : "#fff", color: active ? "#fff" : TOKENS.graphite }}>{children}</button>
  );
}

function SizeGridSection({ p, variant, stockType, stockMap, cart, commitCartChanges, badgeLabel, badgeColor, hint }) {
  const [sizeQty, setSizeQty] = useState({});

  function qtyInCart(size) {
    const item = cart?.find((c) => c.productId === p.id && c.variantId === variant.id && c.size === size && (c.stockType || "pronta") === stockType);
    return item ? item.qty : 0;
  }

  useEffect(() => {
    const initial = {};
    SIZES.forEach((s) => { initial[s] = qtyInCart(s); });
    setSizeQty(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variant.id]);

  function bump(s, stockQty, delta) { setSizeQty((q) => ({ ...q, [s]: Math.max(0, Math.min(stockQty, (q[s] || 0) + delta)) })); }
  function setQtyFor(s, val, stockQty) { setSizeQty((q) => ({ ...q, [s]: Math.max(0, Math.min(stockQty, val)) })); }
  const totalQty = Object.values(sizeQty).reduce((a, b) => a + b, 0);
  const hasChanges = SIZES.some((s) => (sizeQty[s] || 0) !== qtyInCart(s));

  function commitToCart() {
    const changes = {};
    SIZES.forEach((s) => {
      const val = sizeQty[s] || 0;
      if (val !== qtyInCart(s)) changes[s] = val;
    });
    if (Object.keys(changes).length) commitCartChanges(p, variant, changes, stockType);
  }

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: badgeColor }} />
        <span style={{ fontSize: 10.5, fontWeight: 600, color: badgeColor, textTransform: "uppercase", letterSpacing: 0.3 }}>{badgeLabel}</span>
        {hint && <span style={{ fontSize: 10, color: TOKENS.graphite }}>· {hint}</span>}
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
        {SIZES.map((s) => {
          const stockQty = stockMap?.[s] || 0;
          const out = !stockQty;
          const current = sizeQty[s] || 0;
          const inCart = current > 0;
          return (
            <div key={s} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div style={{
                width: "100%", textAlign: "center", padding: "5px 0", borderRadius: 3,
                background: out ? "#F1EDE4" : inCart ? badgeColor : TOKENS.ivorySoft,
                color: out ? "#B8AF9C" : inCart ? "#fff" : TOKENS.ink,
                fontSize: 11.5, fontWeight: 600, textDecoration: out ? "line-through" : "none",
              }}>{s}</div>
              <input type="text" inputMode="numeric" disabled={out} value={current}
                onChange={(e) => setQtyFor(s, parseInt(e.target.value) || 0, stockQty)}
                style={{ width: "100%", textAlign: "center", fontSize: 11.5, border: `1px solid ${inCart ? "#8FBF8F" : TOKENS.line}`, borderRadius: 3, padding: "3px 0", background: out ? "#F1EDE4" : inCart ? "#E9F5E9" : "#fff", color: out ? "#B8AF9C" : inCart ? "#2E6B2E" : TOKENS.ink, fontWeight: inCart ? 600 : 400 }} />
              <div style={{ display: "flex", gap: 3, width: "100%" }}>
                <button disabled={out || current <= 0} onClick={() => bump(s, stockQty, -1)} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "4px 0", borderRadius: 3, border: `1px solid ${TOKENS.line}`, background: "#fff", color: out || current <= 0 ? "#D8D0C0" : TOKENS.graphite, cursor: out || current <= 0 ? "default" : "pointer" }}><Minus size={11} /></button>
                <button disabled={out} onClick={() => bump(s, stockQty, 1)} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "4px 0", borderRadius: 3, border: `1px solid ${TOKENS.line}`, background: "#fff", color: out ? "#D8D0C0" : TOKENS.graphite, cursor: out ? "default" : "pointer" }}><Plus size={11} /></button>
              </div>
            </div>
          );
        })}
      </div>
      <button
        disabled={!hasChanges}
        onClick={commitToCart}
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: hasChanges ? badgeColor : TOKENS.line, color: "#fff", border: "none", borderRadius: 3, padding: "8px 0", fontSize: 12, cursor: hasChanges ? "pointer" : "default" }}>
        <ShoppingCart size={12} /> {hasChanges ? `Adicionar (${totalQty})` : "Adicionar"}
      </button>
    </div>
  );
}

function ProductCard({ p, showPrice, addToCart, cart, commitCartChanges }) {
  const variants = p.variants && p.variants.length ? p.variants : [{ id: "none", color: "", hex: TOKENS.line, images: [], stock: {} }];
  const [vIdx, setVIdx] = useState(0);
  const [imgIdx, setImgIdx] = useState(0);
  const variant = variants[vIdx];
  const imgs = variant.images && variant.images.length ? variant.images : [null];

  useEffect(() => { setImgIdx(0); }, [vIdx]);

  const temProducao = variant.stockProducao && SIZES.some((s) => (variant.stockProducao[s] || 0) > 0);
  const dataProducao = temProducao ? SIZES.map((s) => variant.producaoDate?.[s]).filter(Boolean).sort().pop() : null;

  return (
    <div style={{ background: "#fff", border: `1px solid ${TOKENS.line}`, borderRadius: 4, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <div style={{ position: "relative", aspectRatio: "3/4", background: TOKENS.ivorySoft, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {imgs[imgIdx] ? <img src={imgs[imgIdx]} alt={p.model} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <ImageIcon size={36} color={TOKENS.line} />}
        {imgs.length > 1 && (
          <>
            <button onClick={() => setImgIdx((i) => (i - 1 + imgs.length) % imgs.length)} style={navBtnStyle("left")}><ChevronLeft size={14} /></button>
            <button onClick={() => setImgIdx((i) => (i + 1) % imgs.length)} style={navBtnStyle("right")}><ChevronRight size={14} /></button>
          </>
        )}
      </div>
      <div style={{ padding: "14px 16px 16px" }}>
        {p.category && <div style={{ fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: TOKENS.wine, marginBottom: 3 }}>{p.category}</div>}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
          <div style={{ fontFamily: "Georgia, serif", fontSize: 17, color: TOKENS.ink }}>{p.model}</div>
          {!(p.variants && p.variants.length) && showPrice && <div style={{ fontFamily: "Georgia, serif", fontSize: 17, color: TOKENS.wine, whiteSpace: "nowrap" }}>R$ {p.price}</div>}
        </div>
        {p.sku && <div style={{ fontSize: 10, color: TOKENS.graphite, marginTop: 1 }}>SKU: {p.sku}</div>}
        <div style={{ fontSize: 12.5, color: TOKENS.graphite, marginTop: 4, lineHeight: 1.4, minHeight: 32 }}>{p.description}</div>

        {p.variants && p.variants.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
              <div style={{ fontSize: 10.5, color: TOKENS.graphite }}>Cor: <b style={{ color: TOKENS.ink }}>{variant.color || "—"}</b></div>
              {showPrice && <div style={{ fontFamily: "Georgia, serif", fontSize: 17, color: TOKENS.wine }}>R$ {p.price}</div>}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {variants.map((v, i) => (
                <button key={v.id} onClick={() => setVIdx(i)} title={v.color || "(sem nome)"} style={{
                  width: 22, height: 22, minWidth: 22, borderRadius: "50%", background: v.hex, cursor: "pointer", flexShrink: 0,
                  border: i === vIdx ? `2px solid ${TOKENS.wine}` : `1px solid ${TOKENS.line}`,
                  boxShadow: i === vIdx ? "0 0 0 2px #fff inset" : "none", outline: "none",
                }} />
              ))}
            </div>
          </div>
        )}

        <div style={{ borderTop: `1px dashed ${TOKENS.line}`, paddingTop: 4 }}>
          <SizeGridSection p={p} variant={variant} stockType="pronta" stockMap={variant.stock} cart={cart} commitCartChanges={commitCartChanges} badgeLabel="Pronta entrega" badgeColor={TOKENS.wine} />
          {temProducao && (
            <SizeGridSection p={p} variant={variant} stockType="producao" stockMap={variant.stockProducao} cart={cart} commitCartChanges={commitCartChanges} badgeLabel="Em produção" badgeColor="#BA7517" hint={dataProducao ? `previsão ${new Date(dataProducao).toLocaleDateString("pt-BR")}` : null} />
          )}
        </div>
      </div>
    </div>
  );
}
const qtyBtnStyle = { background: "none", border: "none", cursor: "pointer", padding: "6px 8px", color: TOKENS.graphite };
function navBtnStyle(side) { return { position: "absolute", [side]: 8, top: "50%", transform: "translateY(-50%)", width: 26, height: 26, borderRadius: "50%", border: "none", background: "rgba(23,22,26,0.55)", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }; }

function BannerCarousel({ banners }) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (banners.length < 2) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % banners.length), 4500);
    return () => clearInterval(t);
  }, [banners.length]);
  if (!banners.length) {
    return <div style={{ height: 320, background: `linear-gradient(120deg, ${TOKENS.ink}, ${TOKENS.wineDark})`, display: "flex", alignItems: "center", justifyContent: "center", color: TOKENS.sand, fontFamily: "Georgia, serif", fontSize: 22 }}>Adicione banners no Painel ADM</div>;
  }
  return (
    <div style={{ position: "relative", height: 380, background: TOKENS.ink, overflow: "hidden" }}>
      {banners.map((b, i) => (
        <img key={b.id} src={b.url} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: i === idx ? 1 : 0, transition: "opacity 700ms ease" }} />
      ))}
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(0deg, rgba(0,0,0,0.35), transparent 50%)" }} />
      {banners.length > 1 && (
        <div style={{ position: "absolute", bottom: 14, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 6 }}>
          {banners.map((b, i) => (
            <button key={b.id} onClick={() => setIdx(i)} style={{ width: i === idx ? 20 : 7, height: 7, borderRadius: 4, border: "none", background: i === idx ? TOKENS.sand : "rgba(255,255,255,0.5)", cursor: "pointer", transition: "width 300ms" }} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------- CART ---------------- */
function buildOrderText(cart, session, showPrice, client) {
  const lines = cart.map((c) => {
    const base = `${c.qty}x ${c.model} | Cor: ${c.color} | Tam: ${c.size}`;
    return showPrice ? `${base} | R$ ${c.price} cada` : base;
  });
  const total = cart.reduce((a, c) => a + parseBRL(c.price) * c.qty, 0);
  let text = `Pedido - ${session.name || session.username}\nData: ${new Date().toLocaleDateString("pt-BR")}`;
  if (client) {
    text += `\nCliente: ${client.buyerName || ""}`;
    if (client.cnpj) text += ` | CNPJ: ${client.cnpj}`;
    if (client.phone) text += ` | Tel: ${client.phone}`;
  }
  text += `\n\n${lines.join("\n")}`;
  if (showPrice) text += `\n\nTotal: R$ ${formatBRL(total)}`;
  return text;
}

function CartDrawer({ cart, products, onClose, showPrice, updateCartQty, removeCartItem, clearCart, settings, session, clients, needsClientSelect, selectedClient, setSelectedClient, onFinalizeOrder }) {
  const [note, setNote] = useState("");
  const [step, setStep] = useState("list");
  const [downloading, setDownloading] = useState(false);
  const [sendingWhats, setSendingWhats] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
  const [sendError, setSendError] = useState("");
  // Guarda uma "foto" do pedido no instante de finalizar: como o carrinho é
  // esvaziado assim que o pedido é liberado para a aba Pedidos, a tela de
  // finalização (PDF/e-mail/WhatsApp) precisa continuar mostrando os itens
  // que acabaram de ser enviados, não o carrinho (já vazio) em tempo real.
  const [finalizedSnapshot, setFinalizedSnapshot] = useState(null);
  const displayCart = step === "finalize" && finalizedSnapshot ? finalizedSnapshot.items : cart;
  const displayClient = step === "finalize" && finalizedSnapshot ? finalizedSnapshot.client : selectedClient;
  const total = cart.reduce((a, c) => a + parseBRL(c.price) * c.qty, 0);
  const qtyPronta = cart.filter((c) => c.stockType !== "producao").reduce((a, c) => a + c.qty, 0);
  const qtyProducao = cart.filter((c) => c.stockType === "producao").reduce((a, c) => a + c.qty, 0);
  const qtyTotal = qtyPronta + qtyProducao;
  const valorPronta = cart.filter((c) => c.stockType !== "producao").reduce((a, c) => a + parseBRL(c.price) * c.qty, 0);
  const valorProducao = cart.filter((c) => c.stockType === "producao").reduce((a, c) => a + parseBRL(c.price) * c.qty, 0);
  const MIN_PEDIDO = 2500;
  const orderText = useMemo(() => buildOrderText(displayCart, session, showPrice, displayClient), [displayCart, session, showPrice, displayClient]);
  const orderEmail = (settings.orderEmail || "").trim();
  const mailHref = `mailto:${orderEmail}?subject=${encodeURIComponent(`Novo pedido - ${session.name || session.username}`)}&body=${encodeURIComponent(orderText)}`;
  const waDigits = (settings.orderWhatsapp || "").replace(/\D/g, "");
  const waHref = `https://wa.me/${waDigits}?text=${encodeURIComponent(orderText)}`;
  const hasEmail = orderEmail.length > 3 && orderEmail.includes("@");
  const hasWhats = waDigits.length >= 10;
  const clientReady = !needsClientSelect || !!selectedClient;
  function availableFor(c) {
    const liveProduct = products.find((p) => p.id === c.productId);
    const liveVariant = liveProduct?.variants.find((v) => v.id === c.variantId);
    const bucket = c.stockType === "producao" ? liveVariant?.stockProducao : liveVariant?.stock;
    return bucket?.[c.size] || 0;
  }
  const hasInsufficientStock = cart.some((c) => c.qty > availableFor(c));
  const pdfFileName = `pedido-${(session.name || session.username).replace(/\s+/g, "-").toLowerCase()}.pdf`;

  async function downloadImage() {
    setDownloading(true);
    try {
      const url = await buildOrderImage(displayCart, session, showPrice, displayClient);
      const a = document.createElement("a");
      a.href = url; a.download = `pedido-${(session.name || session.username).replace(/\s+/g, "-").toLowerCase()}.png`;
      document.body.appendChild(a); a.click(); a.remove();
    } finally { setDownloading(false); }
  }

  async function downloadPdf() {
    setDownloading(true);
    setSendError("");
    try {
      const blob = await buildOrderPdfBlob(displayCart, session, showPrice, displayClient, finalizedSnapshot?.note);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = pdfFileName;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setSendError("Não foi possível gerar o PDF agora. Tente novamente em alguns segundos.");
    } finally { setDownloading(false); }
  }

  function copyOrderText() {
    navigator.clipboard?.writeText(orderText);
    setCopiedText(true); setTimeout(() => setCopiedText(false), 1500);
  }

  function sendEmail() {
    setSendError("");
    if (!hasEmail) return;
    try {
      const win = window.open(mailHref, "_blank");
      if (!win) window.location.href = mailHref;
    } catch (e) {
      setSendError(`Não foi possível abrir seu aplicativo de e-mail automaticamente. Use "Copiar texto do pedido" e cole em uma nova mensagem para ${orderEmail}.`);
    }
  }

  // Tenta anexar o PDF de verdade via compartilhamento nativo do aparelho
  // (funciona em celular — abre a mesma tela de "compartilhar" com o WhatsApp
  // como opção, já com o PDF anexado). Não existe forma de anexar arquivo via
  // link wa.me — é uma limitação da própria plataforma, então em computador
  // (ou quando o compartilhamento nativo não está disponível) cai para o link
  // de texto, como já acontecia antes.
  async function sendWhatsapp() {
    setSendError("");
    if (!hasWhats) return;
    setSendingWhats(true);
    try {
      const blob = await buildOrderPdfBlob(displayCart, session, showPrice, displayClient, finalizedSnapshot?.note);
      const file = new File([blob], pdfFileName, { type: "application/pdf" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: "Pedido", text: orderText });
        setSendingWhats(false);
        return;
      }
    } catch (e) {
      if (e?.name === "AbortError") { setSendingWhats(false); return; } // usuário cancelou o compartilhamento
    }
    try {
      const win = window.open(waHref, "_blank", "noopener,noreferrer");
      if (!win) setSendError('Não foi possível abrir o WhatsApp automaticamente. Use "Copiar texto do pedido" e cole numa conversa do WhatsApp.');
    } catch (e) {
      setSendError('Não foi possível abrir o WhatsApp automaticamente. Use "Copiar texto do pedido" e cole numa conversa do WhatsApp.');
    }
    setSendingWhats(false);
  }

  const clientPicker = needsClientSelect && (
    <div style={{ padding: "14px 16px 0" }}>
      <FieldLabel>Pedido para (cliente)</FieldLabel>
      <select value={selectedClient?.id || ""} onChange={(e) => setSelectedClient(clients.find((c) => c.id === e.target.value) || null)} style={inputStyle}>
        <option value="">Selecionar cliente...</option>
        {clients.map((c) => <option key={c.id} value={c.id}>{c.buyerName}{c.cnpj ? ` — ${c.cnpj}` : ""}</option>)}
      </select>
      {clients.length === 0 && <div style={{ fontSize: 11, color: TOKENS.graphite, marginTop: 4 }}>Nenhum cliente cadastrado. Cadastre em "Clientes" no Painel ADM.</div>}
    </div>
  );

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", justifyContent: "flex-end" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(23,22,26,0.5)" }} />
      <div style={{ position: "relative", width: "100%", maxWidth: 420, height: "100%", background: TOKENS.ivory, display: "flex", flexDirection: "column", boxShadow: "-6px 0 24px rgba(0,0,0,0.2)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 20px", background: TOKENS.ink, color: TOKENS.ivory }}>
          <div style={{ fontFamily: "Georgia, serif", fontSize: 18, display: "flex", alignItems: "center", gap: 8 }}><ShoppingCart size={17} /> Seu pedido</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: TOKENS.sand, cursor: "pointer" }}><X size={20} /></button>
        </div>

        {step === "list" && (
          <>
            {clientPicker}
            <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
              {cart.length === 0 && <div style={{ color: TOKENS.graphite, fontSize: 13, textAlign: "center", marginTop: 40 }}>Seu carrinho está vazio.</div>}
              {cart.map((c) => {
                const availableQty = availableFor(c);
                const insufficient = availableQty < c.qty;
                return (
                <div key={c.cartItemId} style={{ display: "flex", gap: 10, background: "#fff", border: `1px solid ${insufficient ? "#E3B3B3" : TOKENS.line}`, borderRadius: 4, padding: 10, marginBottom: 10 }}>
                  <div style={{ width: 54, height: 68, background: TOKENS.ivorySoft, borderRadius: 3, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                    {c.image ? <img src={c.image} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <ImageIcon size={18} color={TOKENS.line} />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: insufficient ? "#A5453F" : TOKENS.ink }}>{c.model}</div>
                    <div style={{ fontSize: 11, color: TOKENS.graphite, display: "flex", alignItems: "center", gap: 5, margin: "3px 0" }}>
                      <span style={{ width: 10, height: 10, borderRadius: "50%", background: c.hex, display: "inline-block", border: `1px solid ${TOKENS.line}` }} /> {c.color} · Tam {c.size}
                      {c.stockType === "producao" && <span style={{ fontSize: 9.5, fontWeight: 600, color: "#633806", background: "#FAEEDA", padding: "1px 6px", borderRadius: 3 }}>EM PRODUÇÃO</span>}
                    </div>
                    {insufficient && <div style={{ fontSize: 10.5, color: "#A5453F", marginBottom: 4 }}>Só {availableQty} disponível — reduza a quantidade para {availableQty} ou menos.</div>}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 6 }}>
                      <div style={{ display: "flex", alignItems: "center", border: `1px solid ${insufficient ? "#E3B3B3" : TOKENS.line}`, borderRadius: 3 }}>
                        <button onClick={() => updateCartQty(c.cartItemId, c.qty - 1)} style={qtyBtnStyle}><Minus size={11} /></button>
                        <span style={{ width: 22, textAlign: "center", fontSize: 12, color: insufficient ? "#A5453F" : TOKENS.ink, fontWeight: insufficient ? 700 : 400 }}>{c.qty}</span>
                        <button onClick={() => updateCartQty(c.cartItemId, c.qty + 1)} style={qtyBtnStyle}><Plus size={11} /></button>
                      </div>
                      {showPrice && <div style={{ fontSize: 12.5, color: TOKENS.wine, fontWeight: 600 }}>R$ {formatBRL(parseBRL(c.price) * c.qty)}</div>}
                      <button onClick={() => removeCartItem(c.cartItemId)} style={{ background: "none", border: "none", color: "#A5453F", cursor: "pointer" }}><Trash2 size={14} /></button>
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
            {cart.length > 0 && (
              <div style={{ padding: "0 16px" }}>
                <label style={labelStyle}>Observações</label>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Ex: entregar embalado separado, cliente pediu urgência, etc." style={{ ...inputStyle, resize: "vertical" }} />
                <div style={{ fontSize: 10, color: TOKENS.graphite, marginTop: 3, marginBottom: 12 }}>Leitura obrigatória por quem recebe o pedido.</div>
              </div>
            )}
            {cart.length > 0 && (
              <div style={{ padding: "0 16px 16px", borderTop: `1px solid ${TOKENS.line}`, background: "#fff", paddingTop: 16 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 3, marginBottom: 12, fontSize: 12, color: TOKENS.graphite }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}><span>Pronta entrega</span><span>{qtyPronta} peça{qtyPronta === 1 ? "" : "s"}{showPrice && <span style={{ color: valorPronta >= MIN_PEDIDO ? "#27500A" : "#A5453F", fontWeight: 600 }}> · R$ {formatBRL(valorPronta)}</span>}</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}><span>Em produção</span><span>{qtyProducao} peça{qtyProducao === 1 ? "" : "s"}{showPrice && <span style={{ color: valorProducao >= MIN_PEDIDO ? "#27500A" : "#A5453F", fontWeight: 600 }}> · R$ {formatBRL(valorProducao)}</span>}</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 600, color: TOKENS.ink, paddingTop: 3, borderTop: `1px dashed ${TOKENS.line}` }}>
                    <span>Total de peças</span>
                    <span>{qtyTotal}{showPrice && <span style={{ color: total >= MIN_PEDIDO ? "#27500A" : "#A5453F" }}> · R$ {formatBRL(total)}</span>}</span>
                  </div>
                </div>
                {showPrice && <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12, fontSize: 15 }}><span>Total</span><b style={{ color: TOKENS.wine, fontFamily: "Georgia, serif", fontSize: 19 }}>R$ {formatBRL(total)}</b></div>}
                {hasInsufficientStock && <div style={{ fontSize: 11.5, color: "#A5453F", marginBottom: 8, textAlign: "center" }}>Ajuste os itens em vermelho (estoque insuficiente) antes de finalizar.</div>}
                <button onClick={() => { setFinalizedSnapshot({ items: cart, client: selectedClient, note }); onFinalizeOrder(note); setStep("finalize"); }} disabled={!clientReady || hasInsufficientStock} title={!clientReady ? "Selecione um cliente para este pedido" : hasInsufficientStock ? "Ajuste os itens em vermelho antes de finalizar" : ""} style={{ ...btnPrimary, width: "100%", justifyContent: "center", opacity: (clientReady && !hasInsufficientStock) ? 1 : 0.5, cursor: (clientReady && !hasInsufficientStock) ? "pointer" : "not-allowed" }}>Finalizar pedido</button>
                {!clientReady && <div style={{ fontSize: 11, color: "#A5453F", marginTop: 6, textAlign: "center" }}>Selecione o cliente acima para continuar.</div>}
                <button onClick={() => { if (confirm("Esvaziar o carrinho?")) clearCart(); }} style={{ ...btnGhostSmall, width: "100%", justifyContent: "center", marginTop: 8 }}>Esvaziar carrinho</button>
              </div>
            )}
          </>
        )}

        {step === "finalize" && (
          <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
            <div style={{ fontSize: 12, color: TOKENS.ok, marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}><Check size={14} /> Pedido enviado para a aba Pedidos.</div>
            {displayClient && (
              <div style={{ background: TOKENS.ivorySoft, border: `1px solid ${TOKENS.sand}`, borderRadius: 4, padding: 10, marginBottom: 14, fontSize: 12 }}>
                <b>{displayClient.buyerName}</b>{displayClient.cnpj ? ` · CNPJ ${displayClient.cnpj}` : ""}{displayClient.phone ? ` · ${displayClient.phone}` : ""}
              </div>
            )}
            <div style={{ fontSize: 12, color: TOKENS.graphite, marginBottom: 12 }}>Fotos principais dos itens:</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
              {displayCart.map((c) => (
                <div key={c.cartItemId} style={{ position: "relative", width: 52, height: 66 }}>
                  <div style={{ width: "100%", height: "100%", borderRadius: 3, border: `1px solid ${TOKENS.line}`, overflow: "hidden", background: TOKENS.ivorySoft, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {c.image ? <img src={c.image} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <ImageIcon size={14} color={TOKENS.line} />}
                  </div>
                  <span style={{ position: "absolute", bottom: -6, right: -6, background: TOKENS.wine, color: "#fff", borderRadius: "50%", width: 17, height: 17, fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>{c.qty}</span>
                </div>
              ))}
            </div>

            <textarea readOnly value={orderText} style={{ width: "100%", minHeight: 160, border: `1px solid ${TOKENS.line}`, borderRadius: 3, padding: 10, fontSize: 12, fontFamily: "monospace", background: "#fff", boxSizing: "border-box", resize: "vertical" }} />

            <div style={{ fontSize: 11, color: TOKENS.graphite, margin: "10px 0 14px", lineHeight: 1.5 }}>
              E-mail abre só com o texto do pedido — não é possível embutir fotos numa mensagem de e-mail simples. Use o PDF ou o PNG abaixo (já com a foto principal de cada peça) para anexar. O botão de WhatsApp já tenta anexar o PDF automaticamente pelo celular.
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              <button onClick={downloadPdf} disabled={downloading} style={{ ...btnGhostSmall, flex: 1, justifyContent: "center", padding: "10px 0" }}><Printer size={14} /> {downloading ? "Gerando..." : "Baixar em PDF"}</button>
              <button onClick={downloadImage} disabled={downloading} style={{ ...btnGhostSmall, flex: 1, justifyContent: "center", padding: "10px 0" }}><Download size={14} /> {downloading ? "Gerando..." : "Baixar PNG"}</button>
            </div>

            {sendError && <div style={{ fontSize: 11.5, color: "#A5453F", background: "#FBEAEA", border: "1px solid #E3B3B3", borderRadius: 3, padding: 10, marginBottom: 12 }}>{sendError}</div>}

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button onClick={sendEmail} disabled={!hasEmail} title={!hasEmail ? "Administrador ainda não cadastrou o e-mail em Configurações" : ""} style={{ ...btnPrimary, justifyContent: "center", opacity: hasEmail ? 1 : 0.45, cursor: hasEmail ? "pointer" : "not-allowed" }}>
                <Mail size={15} /> Enviar por e-mail{hasEmail ? ` (${orderEmail})` : ""}
              </button>
              <button onClick={sendWhatsapp} disabled={!hasWhats || sendingWhats} title={!hasWhats ? "Administrador ainda não cadastrou o WhatsApp em Configurações" : ""} style={{ ...btnPrimary, background: "#3E7A5C", justifyContent: "center", opacity: hasWhats ? 1 : 0.45, cursor: hasWhats ? "pointer" : "not-allowed" }}>
                <MessageCircle size={15} /> {sendingWhats ? "Preparando PDF..." : "Enviar por WhatsApp"}
              </button>
              <button onClick={copyOrderText} style={{ ...btnGhostSmall, justifyContent: "center", padding: "10px 0", color: copiedText ? TOKENS.ok : TOKENS.graphite }}>
                <Copy size={13} /> {copiedText ? "Texto copiado!" : "Copiar texto do pedido"}
              </button>
            </div>
            <div style={{ fontSize: 10.5, color: TOKENS.graphite, marginTop: 10, lineHeight: 1.5 }}>
              Em computador, o WhatsApp abre só com o texto (o navegador não permite anexar arquivo automaticamente nesse caso) — use "Baixar em PDF" e anexe manualmente. Se o botão de e-mail não abrir (comum quando o dispositivo não tem um app padrão configurado), use "Copiar texto do pedido" e cole manualmente numa nova mensagem.
            </div>
            {(!hasEmail && !hasWhats) && <div style={{ fontSize: 11, color: "#A5453F", marginTop: 10 }}>O administrador ainda não cadastrou e-mail/WhatsApp de recebimento em Configurações.</div>}
            <button onClick={() => setStep("list")} style={{ ...btnGhostSmall, marginTop: 16 }}><ChevronLeft size={13} /> Voltar ao carrinho</button>
          </div>
        )}
      </div>
    </div>
  );
}

function PrintableOrder({ cart, showPrice, session, client }) {
  const total = cart.reduce((a, c) => a + parseBRL(c.price) * c.qty, 0);
  return (
    <>
      <style>{`@media print { body * { visibility: hidden; } #print-order, #print-order * { visibility: visible; } #print-order { position: fixed !important; left: 0 !important; top: 0 !important; width: 100%; padding: 28px; } }`}</style>
      <div id="print-order" style={{ position: "absolute", left: -9999, top: 0 }}>
        <h2 style={{ fontFamily: "Georgia, serif" }}>Pedido — {session?.name || session?.username}</h2>
        <div style={{ fontSize: 12, color: "#555" }}>Data: {new Date().toLocaleDateString("pt-BR")}</div>
        {client && <div style={{ fontSize: 13, marginTop: 6 }}><b>Cliente:</b> {client.buyerName} {client.cnpj ? `· CNPJ ${client.cnpj}` : ""} {client.phone ? `· ${client.phone}` : ""}</div>}
        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 16, fontSize: 13 }}>
          <thead><tr style={{ textAlign: "left", borderBottom: "1px solid #999" }}><th>Foto</th><th>Qtd</th><th>Modelo</th><th>Cor</th><th>Tam</th>{showPrice && <th>Preço</th>}</tr></thead>
          <tbody>
            {cart.map((c) => (
              <tr key={c.cartItemId} style={{ borderBottom: "1px solid #ddd" }}>
                <td style={{ padding: "6px 8px 6px 0" }}>{c.image ? <img src={c.image} style={{ width: 46, height: 58, objectFit: "cover" }} /> : "-"}</td>
                <td>{c.qty}</td><td>{c.model}</td><td>{c.color}</td><td>{c.size}</td>
                {showPrice && <td>R$ {formatBRL(parseBRL(c.price) * c.qty)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
        {showPrice && <div style={{ marginTop: 14, fontSize: 15 }}><b>Total: R$ {formatBRL(total)}</b></div>}
      </div>
    </>
  );
}

/* ---------------- ADMIN (funcionário) ---------------- */
function AdminPanel({ users, setUsers, products, setProducts, banners, setBanners, settings, setSettings, clients, setClients, orders, updateStatus, onCopyOrder, stockItems, setStockItems, scanReceiveStock, scanCollectOrder, session, cutBatches, persistCutBatches, lancarCorte, garantirProdutoVariante, persistProducts, aprovarCorte, rejeitarCorte, excluirCortes, garantirCorNoCatalogo }) {
  const tabsAll = [
    { id: "produtos", label: "Produtos & Estoque", icon: Package },
    { id: "itens", label: "Listagem de itens", icon: ListOrdered },
    { id: "coleta", label: "Coleta e Estoque", icon: ScanBarcode },
    { id: "relatorios-corte", label: "Relatórios Estoque e Corte", icon: BarChart3 },
    { id: "catalogo-modelos", label: "Catálogo de Modelos", icon: Crown },
    { id: "pedidos", label: "Pedidos", icon: Archive },
    { id: "clientes", label: "Clientes (Cadastro)", icon: Building2 },
    { id: "login-clientes", label: "Login de Clientes", icon: Users },
    { id: "representantes", label: "Login de Representantes", icon: UserCheck },
    { id: "banners", label: "Banners", icon: GalleryHorizontal },
    { id: "config", label: "Configurações", icon: SettingsIcon },
  ];
  // admincentral sempre vê tudo; funcionário com permissões personalizadas
  // só vê as abas que foram liberadas pra aquele login específico.
  const perms = session?.permissions;
  const tabs = (session?.role === "admincentral" || !perms) ? tabsAll : tabsAll.filter((t) => perms.includes(t.id));
  const [tab, setTab] = useState(tabs[0]?.id || "produtos");
  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", padding: "28px 24px 80px" }}>
      <div style={{ display: "flex", gap: 6, marginBottom: 26, borderBottom: `1px solid ${TOKENS.line}`, flexWrap: "wrap" }}>
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 16px", background: "none", border: "none", borderBottom: tab === t.id ? `2px solid ${TOKENS.wine}` : "2px solid transparent", color: tab === t.id ? TOKENS.wine : TOKENS.graphite, fontSize: 13, cursor: "pointer", fontWeight: tab === t.id ? 600 : 400 }}>
              <Icon size={15} /> {t.label}
            </button>
          );
        })}
      </div>
      {tab === "produtos" && <ProdutosAdmin products={products} setProducts={setProducts} stockItems={stockItems} setStockItems={setStockItems} categories={settings.categories || DEFAULT_CATEGORIES} colors={settings.colors || []} garantirCorNoCatalogo={garantirCorNoCatalogo} />}
      {tab === "itens" && <ItemListAdmin stockItems={stockItems} setStockItems={setStockItems} orders={orders} products={products} setProducts={setProducts} />}
      {tab === "coleta" && <ColetaEstoqueAdmin orders={orders} products={products} stockItems={stockItems} settings={settings} cutBatches={cutBatches} lancarCorte={lancarCorte} garantirProdutoVariante={garantirProdutoVariante} persistProducts={persistProducts} aprovarCorte={aprovarCorte} rejeitarCorte={rejeitarCorte} excluirCortes={excluirCortes} garantirCorNoCatalogo={garantirCorNoCatalogo} scanReceiveStock={scanReceiveStock} scanCollectOrder={scanCollectOrder} updateStatus={updateStatus} session={session} />}
      {tab === "relatorios-corte" && <RelatoriosCorteAdmin cutBatches={cutBatches} products={products} orders={orders} stockItems={stockItems} />}
      {tab === "catalogo-modelos" && <CatalogoModelosAdmin settings={settings} setSettings={setSettings} products={products} setProducts={setProducts} cutBatches={cutBatches} persistCutBatches={persistCutBatches} stockItems={stockItems} setStockItems={setStockItems} />}
      {tab === "pedidos" && <PedidosAdmin orders={orders} updateStatus={updateStatus} clients={clients} onCopyOrder={onCopyOrder} />}
      {tab === "clientes" && <ClientRegistryAdmin clients={clients} setClients={setClients} users={users} repFilterEnabled />}
      {tab === "login-clientes" && <ClientesAdmin users={users} setUsers={setUsers} role="client" title="Login de Clientes" />}
      {tab === "representantes" && <ClientesAdmin users={users} setUsers={setUsers} role="representante" title="Login de Representantes" />}
      {tab === "banners" && <BannersAdmin banners={banners} setBanners={setBanners} />}
      {tab === "config" && <SettingsAdmin settings={settings} setSettings={setSettings} />}
    </div>
  );
}

/* ---------------- ADMIN CENTRAL ---------------- */
function AdminCentralPanel({ users, setUsers, products, setProducts, orders, updateStatus, clients, onCopyOrder }) {
  const [tab, setTab] = useState("funcionarios");
  const tabs = [
    { id: "funcionarios", label: "Login de Funcionários", icon: UserCog },
    { id: "pedidos", label: "Pedidos", icon: Archive },
    { id: "ranking", label: "Ranking de Vendas", icon: TrendingUp },
    { id: "abc", label: "Curva ABC", icon: PieChart },
    { id: "estoque", label: "Estoque & Custos", icon: Archive },
    { id: "vendas-mes", label: "Vendas por Mês", icon: BarChart3 },
    { id: "seguranca", label: "Segurança", icon: Lock },
  ];
  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", padding: "28px 24px 80px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, color: TOKENS.wine }}>
        <Crown size={16} /><span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1.5 }}>Painel Central</span>
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 26, borderBottom: `1px solid ${TOKENS.line}`, flexWrap: "wrap" }}>
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 16px", background: "none", border: "none", borderBottom: tab === t.id ? `2px solid ${TOKENS.wine}` : "2px solid transparent", color: tab === t.id ? TOKENS.wine : TOKENS.graphite, fontSize: 13, cursor: "pointer", fontWeight: tab === t.id ? 600 : 400 }}>
              <Icon size={15} /> {t.label}
            </button>
          );
        })}
      </div>
      {tab === "seguranca" && <AdminCentralSecurity users={users} setUsers={setUsers} />}
      {tab === "funcionarios" && <ClientesAdmin users={users} setUsers={setUsers} role="admin" title="Login de Funcionários" />}
      {tab === "pedidos" && <PedidosAdmin orders={orders} updateStatus={updateStatus} clients={clients} onCopyOrder={onCopyOrder} />}
      {tab === "ranking" && <RankingAdmin products={products} orders={orders} />}
      {tab === "abc" && <ABCAdmin orders={orders} />}
      {tab === "estoque" && <EstoqueCustosAdmin products={products} setProducts={setProducts} />}
      {tab === "vendas-mes" && <VendasMesAdmin orders={orders} />}
    </div>
  );
}

function RankingAdmin({ products, orders }) {
  const [colorFilter, setColorFilter] = useState("");
  const [sizeFilter, setSizeFilter] = useState("");
  const colors = useMemo(() => { const s = new Set(); products.forEach((p) => (p.variants || []).forEach((v) => v.color && s.add(v.color))); return Array.from(s); }, [products]);
  const ranking = useMemo(() => computeRanking(orders, colorFilter, sizeFilter), [orders, colorFilter, sizeFilter]);
  const maxQty = Math.max(1, ...ranking.map((r) => r.qty));
  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <select value={colorFilter} onChange={(e) => setColorFilter(e.target.value)} style={{ ...inputStyle, width: "auto" }}>
          <option value="">Todas as cores</option>
          {colors.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={sizeFilter} onChange={(e) => setSizeFilter(e.target.value)} style={{ ...inputStyle, width: "auto" }}>
          <option value="">Todos os tamanhos</option>
          {SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      {ranking.length === 0 ? (
        <div style={{ color: TOKENS.graphite, padding: 30 }}>Ainda não há pedidos finalizados para gerar o ranking.</div>
      ) : (
        <div style={{ background: "#fff", border: `1px solid ${TOKENS.line}`, borderRadius: 4, overflow: "hidden" }}>
          {ranking.map((r, i) => (
            <div key={r.model} style={{ padding: "12px 16px", borderBottom: `1px solid ${TOKENS.ivorySoft}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
                <span><b>{i + 1}.</b> {r.model}</span>
                <span style={{ color: TOKENS.graphite }}>{r.qty} un. · R$ {formatBRL(r.revenue)}</span>
              </div>
              <div style={{ height: 6, background: TOKENS.ivorySoft, borderRadius: 3, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${(r.qty / maxQty) * 100}%`, background: TOKENS.wine }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ABCAdmin({ orders }) {
  const rows = useMemo(() => computeABC(orders), [orders]);
  const clsColor = { A: TOKENS.ok, B: "#B8862E", C: "#A5453F" };
  return (
    <div>
      <div style={{ fontSize: 12, color: TOKENS.graphite, marginBottom: 14 }}>Classificação pela receita acumulada: A = até 80%, B = até 95%, C = restante.</div>
      {rows.length === 0 ? (
        <div style={{ color: TOKENS.graphite, padding: 30 }}>Ainda não há vendas registradas.</div>
      ) : (
        <div style={{ background: "#fff", border: `1px solid ${TOKENS.line}`, borderRadius: 4, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead><tr style={{ textAlign: "left", background: TOKENS.ivorySoft }}>
              <th style={thStyle}>Modelo</th><th style={thStyle}>Receita</th><th style={thStyle}>% Receita</th><th style={thStyle}>% Acumulado</th><th style={thStyle}>Classe</th>
            </tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.model} style={{ borderTop: `1px solid ${TOKENS.ivorySoft}` }}>
                  <td style={tdStyle}>{r.model}</td>
                  <td style={tdStyle}>R$ {formatBRL(r.revenue)}</td>
                  <td style={tdStyle}>{r.pct.toFixed(1)}%</td>
                  <td style={tdStyle}>{r.cumPct.toFixed(1)}%</td>
                  <td style={tdStyle}><span style={{ background: clsColor[r.cls], color: "#fff", padding: "2px 8px", borderRadius: 10, fontSize: 11 }}>{r.cls}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function EstoqueCustosAdmin({ products, setProducts }) {
  function updateCost(id, val) { setProducts(products.map((p) => p.id === id ? { ...p, costPrice: val } : p)); }
  let totalCostAll = 0, totalPriceAll = 0;
  return (
    <div>
      <div style={{ fontSize: 12, color: TOKENS.graphite, marginBottom: 14 }}>Preço de custo é usado só aqui, para calcular margem e valor de estoque — não aparece para funcionários nem na vitrine.</div>
      {products.map((p) => {
        const cost = parseBRL(p.costPrice);
        const price = parseBRL(p.price);
        const marginPct = cost ? ((price - cost) / cost * 100) : 0;
        let prodStockQty = 0, prodCostVal = 0, prodPriceVal = 0;
        (p.variants || []).forEach((v) => SIZES.forEach((s) => { const q = v.stock?.[s] || 0; prodStockQty += q; prodCostVal += q * cost; prodPriceVal += q * price; }));
        totalCostAll += prodCostVal; totalPriceAll += prodPriceVal;
        return (
          <div key={p.id} style={{ background: "#fff", border: `1px solid ${TOKENS.line}`, borderRadius: 4, padding: 14, marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 10, color: TOKENS.wine, textTransform: "uppercase", letterSpacing: 1 }}>{p.category}</div>
                <div style={{ fontFamily: "Georgia, serif", fontSize: 16 }}>{p.model}</div>
              </div>
              <div style={{ display: "flex", gap: 14, alignItems: "center", fontSize: 12, flexWrap: "wrap" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 6 }}>Custo: <input value={p.costPrice || ""} onChange={(e) => updateCost(p.id, e.target.value)} placeholder="0,00" style={{ ...inputStyle, width: 80 }} /></label>
                <span>Venda: R$ {p.price || "0,00"}</span>
                <span style={{ color: marginPct >= 0 ? TOKENS.ok : "#A5453F", fontWeight: 600 }}>Margem: {marginPct.toFixed(0)}%</span>
              </div>
            </div>
            <div style={{ fontSize: 11.5, color: TOKENS.graphite }}>Estoque total: {prodStockQty} un. · Valor em custo: R$ {formatBRL(prodCostVal)} · Valor em venda: R$ {formatBRL(prodPriceVal)}</div>
          </div>
        );
      })}
      {products.length > 0 && (
        <div style={{ background: TOKENS.ink, color: "#fff", borderRadius: 4, padding: 16, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, fontSize: 13 }}>
          <b>Total do estoque</b>
          <span>Custo: R$ {formatBRL(totalCostAll)} · Venda: R$ {formatBRL(totalPriceAll)} · Margem potencial: R$ {formatBRL(totalPriceAll - totalCostAll)}</span>
        </div>
      )}
    </div>
  );
}

function VendasMesAdmin({ orders }) {
  const { year, totals } = useMemo(() => computeMonthlySales(orders), [orders]);
  const yearTotal = totals.reduce((a, m) => a + m.revenue, 0);
  return (
    <div>
      <div style={{ fontFamily: "Georgia, serif", fontSize: 17, marginBottom: 4 }}>Vendas em {year}</div>
      <div style={{ fontSize: 12, color: TOKENS.graphite, marginBottom: 16 }}>Total do ano até agora: R$ {formatBRL(yearTotal)} · {orders.length} pedido(s) registrados no total (todo o histórico).</div>
      <div style={{ background: "#fff", border: `1px solid ${TOKENS.line}`, borderRadius: 4, padding: 16, height: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={totals}>
            <CartesianGrid strokeDasharray="3 3" stroke={TOKENS.line} />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v) => `R$ ${formatBRL(v)}`} />
            <Bar dataKey="revenue" fill={TOKENS.wine} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function AdminCentralSecurity({ users, setUsers }) {
  const [current, setCurrent] = useState("");
  const [next1, setNext1] = useState("");
  const [next2, setNext2] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const authEmail = users.admincentral?.authEmail;

  // Confirma a senha atual reautenticando de verdade no Supabase (não é só
  // uma comparação de texto), e só então troca pela nova senha.
  async function save() {
    setError(""); setSaved(false);
    if (!authEmail) { setError("Este login ainda não foi migrado para o sistema de senha seguro."); return; }
    if (!next1.trim() || next1.length < 6) { setError("A nova senha precisa ter pelo menos 6 caracteres."); return; }
    if (next1 !== next2) { setError("As duas senhas novas não coincidem."); return; }
    setLoading(true);
    const { error: authCheck } = await supabase.auth.signInWithPassword({ email: authEmail, password: current });
    if (authCheck) { setLoading(false); setError("Senha atual incorreta."); return; }
    const { error: updateError } = await supabase.auth.updateUser({ password: next1.trim() });
    setLoading(false);
    if (updateError) { setError("Não foi possível trocar a senha agora. Tente novamente."); return; }
    setCurrent(""); setNext1(""); setNext2("");
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div style={{ background: "#fff", border: `1px solid ${TOKENS.line}`, borderRadius: 4, padding: 22, maxWidth: 420 }}>
      <div style={{ fontFamily: "Georgia, serif", fontSize: 17, marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}><Lock size={16} color={TOKENS.wine} /> Alterar senha do Admin Central</div>
      <div style={{ fontSize: 12, color: TOKENS.graphite, marginBottom: 16 }}>Essa é a senha de login usada pelo Admin Central para entrar no sistema.</div>
      <FieldLabel>Senha atual</FieldLabel>
      <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} style={inputStyle} placeholder="Digite a senha atual" />
      <FieldLabel>Nova senha</FieldLabel>
      <input type="password" value={next1} onChange={(e) => setNext1(e.target.value)} style={inputStyle} placeholder="Digite a nova senha" />
      <FieldLabel>Confirmar nova senha</FieldLabel>
      <input type="password" value={next2} onChange={(e) => setNext2(e.target.value)} style={inputStyle} placeholder="Digite a nova senha de novo" />
      {error && <div style={{ fontSize: 12, color: "#A5453F", marginTop: 10 }}>{error}</div>}
      <button onClick={save} disabled={loading} style={{ ...btnPrimary, marginTop: 16, opacity: loading ? 0.7 : 1 }}><Check size={15} /> {loading ? "Salvando..." : "Salvar nova senha"}</button>
      {saved && <span style={{ marginLeft: 10, fontSize: 12, color: TOKENS.ok }}>Senha atualizada!</span>}
    </div>
  );
}

function SettingsAdmin({ settings, setSettings }) {
  const [email, setEmail] = useState(settings.orderEmail || "");
  const [whats, setWhats] = useState(settings.orderWhatsapp || "");
  const [saved, setSaved] = useState(false);
  function save() { setSettings({ ...settings, orderEmail: email.trim(), orderWhatsapp: whats.trim() }); setSaved(true); setTimeout(() => setSaved(false), 1500); }

  const fe = settings.fiscalEmitente || {};
  const [razaoSocial, setRazaoSocial] = useState(fe.razaoSocial || "");
  const [nomeFantasia, setNomeFantasia] = useState(fe.nomeFantasia || "");
  const [cnpj, setCnpj] = useState(fe.cnpj || "");
  const [ie, setIe] = useState(fe.ie || "");
  const [regimeTributario, setRegimeTributario] = useState(fe.regimeTributario || "Simples Nacional");
  const [cep, setCep] = useState(fe.cep || "");
  const [endereco, setEndereco] = useState(fe.endereco || "");
  const [cidade, setCidade] = useState(fe.cidade || "");
  const [uf, setUf] = useState(fe.uf || "");
  const [telefone, setTelefone] = useState(fe.telefone || "");
  const [savedFiscal, setSavedFiscal] = useState(false);
  function saveFiscal() {
    setSettings({
      ...settings,
      fiscalEmitente: {
        razaoSocial: razaoSocial.trim(), nomeFantasia: nomeFantasia.trim(), cnpj: cnpj.trim(), ie: ie.trim(),
        regimeTributario, cep: cep.trim(), endereco: endereco.trim(), cidade: cidade.trim(), uf: uf.trim(), telefone: telefone.trim(),
      },
    });
    setSavedFiscal(true); setTimeout(() => setSavedFiscal(false), 1500);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ background: "#fff", border: `1px solid ${TOKENS.line}`, borderRadius: 4, padding: 22, maxWidth: 460 }}>
        <div style={{ fontFamily: "Georgia, serif", fontSize: 17, marginBottom: 4 }}>Recebimento de pedidos</div>
        <div style={{ fontSize: 12, color: TOKENS.graphite, marginBottom: 16 }}>Sempre que um cliente finalizar um pedido no carrinho, ele poderá enviá-lo com um clique para este e-mail e WhatsApp.</div>
        <FieldLabel>E-mail para receber pedidos</FieldLabel>
        <input value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} placeholder="pedidos@suaempresa.com.br" />
        <FieldLabel>WhatsApp para receber pedidos (com DDI e DDD)</FieldLabel>
        <input value={whats} onChange={(e) => setWhats(e.target.value)} style={inputStyle} placeholder="55 71 99999-9999" />
        <button onClick={save} style={{ ...btnPrimary, marginTop: 16 }}><Check size={15} /> Salvar</button>
        {saved && <span style={{ marginLeft: 10, fontSize: 12, color: TOKENS.ok }}>Salvo!</span>}
        <div style={{ fontSize: 11, color: TOKENS.graphite, marginTop: 14, lineHeight: 1.5 }}>
          Observação: e-mail e WhatsApp são protocolos de texto — não é possível embutir fotos dentro da mensagem em si. Por isso, ao finalizar o pedido, o cliente também pode baixar um PDF ou PNG (com a foto principal de cada peça) para anexar antes de enviar.
        </div>
      </div>

      <div style={{ background: "#fff", border: `1px solid ${TOKENS.line}`, borderRadius: 4, padding: 22, maxWidth: 460 }}>
        <div style={{ fontFamily: "Georgia, serif", fontSize: 17, marginBottom: 4 }}>Dados fiscais do emitente</div>
        <div style={{ fontSize: 12, color: TOKENS.graphite, marginBottom: 16 }}>Dados da empresa que vai emitir a nota fiscal. Preparação para quando a emissão for ativada — por enquanto, nada disso envia nota de verdade.</div>

        <FieldLabel>Razão social</FieldLabel>
        <input value={razaoSocial} onChange={(e) => setRazaoSocial(e.target.value)} style={inputStyle} placeholder="Ex: Mallo Confecções LTDA" />

        <FieldLabel>Nome fantasia</FieldLabel>
        <input value={nomeFantasia} onChange={(e) => setNomeFantasia(e.target.value)} style={inputStyle} placeholder="Ex: Mallo" />

        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ flex: 1 }}>
            <FieldLabel>CNPJ</FieldLabel>
            <input value={cnpj} onChange={(e) => setCnpj(e.target.value)} style={inputStyle} placeholder="00.000.000/0000-00" />
          </div>
          <div style={{ flex: 1 }}>
            <FieldLabel>Inscrição estadual</FieldLabel>
            <input value={ie} onChange={(e) => setIe(e.target.value)} style={inputStyle} placeholder="Ex: 123.456.789" />
          </div>
        </div>

        <FieldLabel>Regime tributário</FieldLabel>
        <select value={regimeTributario} onChange={(e) => setRegimeTributario(e.target.value)} style={inputStyle}>
          <option>Simples Nacional</option>
          <option>Lucro Presumido</option>
          <option>Lucro Real</option>
          <option>MEI</option>
        </select>

        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ flex: 1 }}>
            <FieldLabel>CEP</FieldLabel>
            <input value={cep} onChange={(e) => setCep(e.target.value)} style={inputStyle} placeholder="00000-000" />
          </div>
          <div style={{ flex: 2 }}>
            <FieldLabel>Endereço</FieldLabel>
            <input value={endereco} onChange={(e) => setEndereco(e.target.value)} style={inputStyle} placeholder="Rua, número, bairro" />
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ flex: 2 }}>
            <FieldLabel>Cidade</FieldLabel>
            <input value={cidade} onChange={(e) => setCidade(e.target.value)} style={inputStyle} placeholder="Ex: Salvador" />
          </div>
          <div style={{ flex: 1 }}>
            <FieldLabel>UF</FieldLabel>
            <input value={uf} onChange={(e) => setUf(e.target.value.toUpperCase())} style={inputStyle} placeholder="BA" maxLength={2} />
          </div>
        </div>

        <FieldLabel>Telefone</FieldLabel>
        <input value={telefone} onChange={(e) => setTelefone(e.target.value)} style={inputStyle} placeholder="71 99999-9999" />

        <button onClick={saveFiscal} style={{ ...btnPrimary, marginTop: 16 }}><Check size={15} /> Salvar dados fiscais</button>
        {savedFiscal && <span style={{ marginLeft: 10, fontSize: 12, color: TOKENS.ok }}>Salvo!</span>}
      </div>
    </div>
  );
}

function ClientRegistryAdmin({ clients, setClients, users, repFilterEnabled, repScope }) {
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [repFilter, setRepFilter] = useState("");

  const reps = useMemo(() => users ? Object.entries(users).filter(([, u]) => u.role === "representante").map(([username, u]) => ({ username, name: u.name })) : [], [users]);
  function repName(username) { if (!username) return "Equipe interna"; const r = reps.find((x) => x.username === username); return r ? r.name : username; }

  const visible = repScope
    ? clients.filter((c) => c.repUsername === repScope)
    : repFilter === "" ? clients
    : repFilter === "__none__" ? clients.filter((c) => !c.repUsername)
    : clients.filter((c) => c.repUsername === repFilter);

  function startNew() { setEditing({ id: uid("cl_"), buyerName: "", razaoSocial: "", cnpj: "", ie: "", cpf: "", cep: "", address: "", email: "", phone: "", whatsapp: "", instagram: "", references: "", repUsername: repScope || "" }); setShowForm(true); }
  function startEdit(c) { setEditing({ ...c }); setShowForm(true); }
  function remove(id) { if (confirm("Remover este cliente do cadastro?")) setClients(clients.filter((c) => c.id !== id)); }
  function save(c) {
    if (!c.buyerName.trim()) return;
    const exists = clients.some((x) => x.id === c.id);
    setClients(exists ? clients.map((x) => (x.id === c.id ? c : x)) : [c, ...clients]);
    setShowForm(false); setEditing(null);
  }
  async function exportarExcel() {
    const XLSX = await loadXLSX();
    const rows = visible.map((c) => ({
      "Nome/Empresa": c.buyerName, "Razão Social": c.razaoSocial || "", "CNPJ": c.cnpj || "", "CPF": c.cpf || "", "IE": c.ie || "", "CEP": c.cep || "",
      "E-mail": c.email || "", "Telefone": c.phone || "", "WhatsApp": c.whatsapp || "", "Endereço": c.address || "",
      "Instagram": c.instagram || "", "Referências": c.references || "", "Representante": repName(c.repUsername),
    }));
    downloadXLSX(XLSX, rows, "Clientes", `clientes-mallo-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <div style={{ fontSize: 13, color: TOKENS.graphite }}>{visible.length} cliente(s) {repScope ? "seus" : "cadastrado(s)"} — esta lista aparece para seleção no início de cada pedido.</div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {repFilterEnabled && (
            <select value={repFilter} onChange={(e) => setRepFilter(e.target.value)} style={{ ...inputStyle, width: "auto" }}>
              <option value="">Todos os representantes</option>
              <option value="__none__">Equipe interna (sem representante)</option>
              {reps.map((r) => <option key={r.username} value={r.username}>{r.name}</option>)}
            </select>
          )}
          <button onClick={exportarExcel} style={btnGhostSmall}><Download size={13} /> Exportar Excel</button>
          <button onClick={startNew} style={btnPrimary}><Plus size={15} /> Novo cliente</button>
        </div>
      </div>
      <div style={{ background: "#fff", border: `1px solid ${TOKENS.line}`, borderRadius: 4, overflow: "hidden" }}>
        {visible.length === 0 && <div style={{ padding: 20, color: TOKENS.graphite, fontSize: 13 }}>Nenhum cliente cadastrado ainda.</div>}
        {visible.map((c) => (
          <div key={c.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: `1px solid ${TOKENS.ivorySoft}`, flexWrap: "wrap", gap: 8 }}>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: TOKENS.ink }}>{c.buyerName}</div>
              <div style={{ fontSize: 11.5, color: TOKENS.graphite }}>
                {[c.cnpj && `CNPJ ${c.cnpj}`, c.phone, c.email, c.instagram].filter(Boolean).join(" · ") || "Sem dados adicionais"}
              </div>
              {!repScope && <div style={{ fontSize: 10.5, color: TOKENS.wine, marginTop: 2 }}>Cadastrado por: {repName(c.repUsername)}</div>}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => startEdit(c)} style={btnGhostSmall}><Pencil size={13} /> Editar</button>
              <button onClick={() => remove(c.id)} style={{ ...btnGhostSmall, color: "#A5453F" }}><Trash2 size={13} /> Excluir</button>
            </div>
          </div>
        ))}
      </div>
      {showForm && <ClientForm initial={editing} onCancel={() => { setShowForm(false); setEditing(null); }} onSave={save} />}
    </div>
  );
}

function RepClientsPanel({ clients, setClients, session }) {
  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", padding: "28px 24px 80px" }}>
      <div style={{ fontFamily: "Georgia, serif", fontSize: 24, color: TOKENS.ink, marginBottom: 4 }}>Meus Clientes</div>
      <div style={{ fontSize: 12.5, color: TOKENS.graphite, marginBottom: 22 }}>Clientes que você cadastra aqui ficam disponíveis para seleção nos seus pedidos, e também aparecem no Painel ADM da administração, filtrados pelo seu nome.</div>
      <ClientRegistryAdmin clients={clients} setClients={setClients} repScope={session.username} />
    </div>
  );
}

const ORDER_STATUSES = ["Enviado à fábrica", "Crédito liberado", "Crédito bloqueado", "Pedido em preparação", "Pedido enviado", "Pedido completo", "Pedido cancelado"];
const ORDER_STATUS_COLORS = {
  "Enviado à fábrica": { bg: "#E6F1FB", fg: "#0C447C" },
  "Crédito liberado": { bg: "#EAF3DE", fg: "#27500A" },
  "Crédito bloqueado": { bg: "#FCEBEB", fg: "#791F1F" },
  "Pedido em preparação": { bg: "#FAEEDA", fg: "#633806" },
  "Pedido enviado": { bg: "#EEEDFE", fg: "#3C3489" },
  "Pedido completo": { bg: "#EAF3DE", fg: "#1F4E10" },
  "Pedido cancelado": { bg: "#F3DCDC", fg: "#6E2C2C" },
};

function PedidosAdmin({ orders, updateStatus, scopeUsername, readOnly, clients = [], onCopyOrder }) {
  const list = (scopeUsername ? orders.filter((o) => o.sellerUsername === scopeUsername) : orders).slice().reverse();
  const [downloadingId, setDownloadingId] = useState("");
  const [copyModalOrder, setCopyModalOrder] = useState(null);
  const [copyClientId, setCopyClientId] = useState("");
  const [expandedId, setExpandedId] = useState("");

  async function downloadOrderPdf(o) {
    setDownloadingId(o.id);
    try {
      const blob = await buildOrderPdfBlob(o.items, { name: o.sellerName, username: o.sellerUsername }, true, { buyerName: o.clientName }, o.note);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `pedido-${o.clientName.replace(/\s+/g, "-").toLowerCase()}-${o.id}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert("Não foi possível gerar o PDF agora. Tente novamente em alguns segundos.");
    } finally { setDownloadingId(""); }
  }

  function confirmCopy() {
    const client = clients.find((c) => c.id === copyClientId);
    if (!client) return;
    onCopyOrder(copyModalOrder, client);
    setCopyModalOrder(null);
    setCopyClientId("");
  }

  return (
    <div>
      <div style={{ fontFamily: "Georgia, serif", fontSize: 22, color: TOKENS.ink, marginBottom: 16 }}>Pedidos</div>
      <div style={{ background: "#fff", border: `1px solid ${TOKENS.line}`, borderRadius: 4, overflow: "hidden" }}>
        {list.length === 0 && <div style={{ padding: 20, fontSize: 13, color: TOKENS.graphite }}>Nenhum pedido encontrado.</div>}
        {list.map((o) => {
          const total = o.items.reduce((a, it) => a + it.qty * it.price, 0);
          const qtdItens = o.items.reduce((a, it) => a + it.qty, 0);
          const lastLog = o.statusLog && o.statusLog[o.statusLog.length - 1];
          const colors = ORDER_STATUS_COLORS[o.status] || { bg: TOKENS.ivorySoft, fg: TOKENS.graphite };
          const isCancelled = o.status === "Pedido cancelado";
          return (
            <div key={o.id} style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 0.6fr 1fr 1.6fr auto", gap: 12, alignItems: "center", padding: "14px 16px", borderBottom: `1px solid ${TOKENS.ivorySoft}` }}>
              <div>
                <div style={{ fontSize: 13.5, color: TOKENS.ink }}>{o.clientName}</div>
                <div style={{ fontSize: 11, color: TOKENS.graphite }}>por {o.sellerName}</div>
              </div>
              <div style={{ fontSize: 12.5, color: TOKENS.graphite }}>{new Date(o.date).toLocaleDateString("pt-BR")}</div>
              <div style={{ fontSize: 12.5, color: TOKENS.graphite }}>{qtdItens} peça(s)</div>
              <div style={{ fontSize: 13, color: TOKENS.ink }}>R$ {total.toFixed(2).replace(".", ",")}</div>
              <div>
                {(readOnly || isCancelled) ? (
                  <span style={{ fontSize: 11.5, padding: "4px 10px", borderRadius: 3, background: colors.bg, color: colors.fg }}>{o.status}</span>
                ) : (
                  <select value={o.status} onChange={(e) => updateStatus(o.id, e.target.value)} style={{ fontSize: 12, padding: "5px 6px", borderRadius: 3, border: `1px solid ${TOKENS.line}` }}>
                    {ORDER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                )}
                {lastLog && <div style={{ fontSize: 10, color: TOKENS.graphite, marginTop: 4 }}>Alterado por {lastLog.by} · {new Date(lastLog.when).toLocaleString("pt-BR")}</div>}
                {o.note && <div style={{ fontSize: 11, color: "#633806", background: "#FAEEDA", padding: "4px 8px", borderRadius: 3, marginTop: 5 }}><b>Obs:</b> {o.note}</div>}
                {o.status === "Pedido completo" && o.collectedBy && <div style={{ fontSize: 10, color: TOKENS.ok, marginTop: 2 }}>Coletado por {o.collectedBy} · {o.collectedAt ? new Date(o.collectedAt).toLocaleString("pt-BR") : ""}</div>}
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => setExpandedId(expandedId === o.id ? "" : o.id)} title="Ver movimentações" style={{ ...iconBtnStyle, border: `1px solid ${TOKENS.line}`, borderRadius: 3 }}>
                  {expandedId === o.id ? <Minus size={14} /> : <Plus size={14} />}
                </button>
                <button onClick={() => downloadOrderPdf(o)} disabled={downloadingId === o.id} style={{ ...btnGhostSmall, whiteSpace: "nowrap" }}>
                  <Printer size={13} /> {downloadingId === o.id ? "Gerando..." : "Baixar PDF"}
                </button>
                {onCopyOrder && (
                  <button onClick={() => { setCopyModalOrder(o); setCopyClientId(""); }} style={{ ...btnGhostSmall, whiteSpace: "nowrap" }}>
                    <Copy size={13} /> Copiar
                  </button>
                )}
              </div>
              {expandedId === o.id && (
                <div style={{ gridColumn: "1 / -1", background: TOKENS.ivorySoft, borderRadius: 4, padding: "10px 14px", fontSize: 12 }}>
                  <div style={{ fontWeight: 600, marginBottom: 6, color: TOKENS.ink }}>Movimentações deste pedido</div>
                  {(!o.statusLog || !o.statusLog.length) && <div style={{ color: TOKENS.graphite }}>Nenhum registro de movimentação.</div>}
                  {(o.statusLog || []).map((l, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: i < o.statusLog.length - 1 ? `1px dashed ${TOKENS.line}` : "none" }}>
                      <span>{l.status} — por {l.by}</span>
                      <span style={{ color: TOKENS.graphite }}>{new Date(l.when).toLocaleString("pt-BR")}</span>
                    </div>
                  ))}
                  {o.collectedBy && (
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", marginTop: 4, borderTop: `1px solid ${TOKENS.line}`, color: TOKENS.ok }}>
                      <span>Coleta confirmada — por {o.collectedBy}</span>
                      <span>{o.collectedAt ? new Date(o.collectedAt).toLocaleString("pt-BR") : ""}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {copyModalOrder && (
        <div style={overlayStyle}>
          <div style={{ ...modalStyle, maxWidth: 420 }}>
            <div style={modalHeaderStyle}>
              <div style={{ fontFamily: "Georgia, serif", fontSize: 16 }}>Copiar pedido para outro cliente</div>
              <button onClick={() => setCopyModalOrder(null)} style={{ background: "none", border: "none", cursor: "pointer", color: TOKENS.graphite }}><X size={18} /></button>
            </div>
            <div style={{ padding: 20 }}>
              <div style={{ fontSize: 12.5, color: TOKENS.graphite, marginBottom: 14, lineHeight: 1.5 }}>
                Leva os mesmos itens de "{copyModalOrder.clientName}" para o seu carrinho, já atribuídos ao cliente selecionado abaixo, para você revisar antes de finalizar. Se você já tiver itens no carrinho, eles serão substituídos.
              </div>
              <FieldLabel>Cliente de destino</FieldLabel>
              <select value={copyClientId} onChange={(e) => setCopyClientId(e.target.value)} style={inputStyle}>
                <option value="">Selecionar cliente...</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.buyerName}{c.cnpj ? ` — ${c.cnpj}` : ""}</option>)}
              </select>
              {clients.length === 0 && <div style={{ fontSize: 11, color: TOKENS.graphite, marginTop: 6 }}>Nenhum cliente cadastrado.</div>}
            </div>
            <div style={modalFooterStyle}>
              <button onClick={() => setCopyModalOrder(null)} style={btnGhostSmall}>Cancelar</button>
              <button onClick={confirmCopy} disabled={!copyClientId} style={{ ...btnPrimary, opacity: copyClientId ? 1 : 0.5, cursor: copyClientId ? "pointer" : "not-allowed" }}>Copiar pedido</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ClientForm({ initial, onCancel, onSave }) {
  const [c, setC] = useState(initial);
  const [buscando, setBuscando] = useState("");
  const [cnpjInvalido, setCnpjInvalido] = useState(false);
  const [erros, setErros] = useState({});

  async function handleCnpjChange(value) {
    const masked = maskCNPJ(value);
    setC((s) => ({ ...s, cnpj: masked }));
    const digits = masked.replace(/\D/g, "");
    if (digits.length === 14) {
      if (!isValidCNPJ(digits)) { setCnpjInvalido(true); return; }
      setCnpjInvalido(false);
      setBuscando("cnpj");
      const dados = await buscarCNPJ(digits);
      setBuscando("");
      if (dados) {
        setC((s) => ({
          ...s,
          razaoSocial: s.razaoSocial || dados.razao_social || dados.nome_fantasia || s.razaoSocial,
          cep: s.cep || (dados.cep ? maskCEP(String(dados.cep)) : s.cep),
          address: s.address || [dados.logradouro, dados.numero, dados.bairro, dados.municipio, dados.uf].filter(Boolean).join(", "),
        }));
      }
    } else {
      setCnpjInvalido(false);
    }
  }

  async function handleCepChange(value) {
    const masked = maskCEP(value);
    setC((s) => ({ ...s, cep: masked }));
    const digits = masked.replace(/\D/g, "");
    if (digits.length === 8) {
      setBuscando("cep");
      const dados = await buscarCEP(digits);
      setBuscando("");
      if (dados) {
        setC((s) => ({ ...s, address: [dados.logradouro, dados.bairro, dados.localidade, dados.uf].filter(Boolean).join(", ") }));
      }
    }
  }

  function trySave() {
    const novosErros = {};
    CLIENT_FIELDS.forEach((f) => { if (!c[f.key] || !String(c[f.key]).trim()) novosErros[f.key] = true; });
    if (c.cnpj && !isValidCNPJ(c.cnpj)) { novosErros.cnpj = true; setCnpjInvalido(true); }
    setErros(novosErros);
    if (Object.keys(novosErros).length > 0) return;
    onSave(c);
  }

  return (
    <div style={overlayStyle}>
      <div style={{ ...modalStyle, maxWidth: 560 }}>
        <div style={modalHeaderStyle}>
          <div style={{ fontFamily: "Georgia, serif", fontSize: 18 }}>{initial.buyerName ? "Editar cliente" : "Novo cliente"}</div>
          <button onClick={onCancel} style={iconBtnStyle}><X size={18} /></button>
        </div>
        <div style={{ padding: 20, maxHeight: "72vh", overflowY: "auto" }}>
          {Object.keys(erros).length > 0 && (
            <div style={{ background: "#FCEBEB", color: "#791F1F", fontSize: 12.5, padding: "8px 12px", borderRadius: 4, marginBottom: 14 }}>
              Preencha todos os campos marcados com * antes de salvar.
            </div>
          )}
          {CLIENT_FIELDS.map((f) => {
            const comErro = !!erros[f.key] || (f.key === "cnpj" && cnpjInvalido);
            const estilo = comErro ? { ...inputStyle, border: "1px solid #A5453F", background: "#FCEBEB" } : inputStyle;
            return (
              <div key={f.key}>
                <FieldLabel>
                  {f.label} <span style={{ color: "#A5453F" }}>*</span> {buscando === f.key && <span style={{ color: TOKENS.wine, fontWeight: 400 }}>· buscando...</span>}
                </FieldLabel>
                {f.key === "references" ? (
                  <textarea value={c[f.key]} onChange={(e) => setC({ ...c, [f.key]: e.target.value })} style={{ ...estilo, minHeight: 60, resize: "vertical" }} />
                ) : f.key === "cnpj" ? (
                  <input value={c.cnpj || ""} onChange={(e) => handleCnpjChange(e.target.value)} placeholder="Só os números" style={estilo} />
                ) : f.key === "cep" ? (
                  <input value={c.cep || ""} onChange={(e) => handleCepChange(e.target.value)} placeholder="Só os números" style={estilo} />
                ) : (
                  <input value={c[f.key]} onChange={(e) => setC({ ...c, [f.key]: e.target.value })} style={estilo} />
                )}
                {f.key === "cnpj" && cnpjInvalido ? (
                  <div style={{ fontSize: 11, color: "#A5453F", marginTop: 2, marginBottom: 4 }}>Esse CNPJ não é válido — confira os números.</div>
                ) : comErro && <div style={{ fontSize: 11, color: "#A5453F", marginTop: 2, marginBottom: 4 }}>Este campo é obrigatório.</div>}
              </div>
            );
          })}
        </div>
        <div style={modalFooterStyle}>
          <button onClick={onCancel} style={btnGhostSmall}>Cancelar</button>
          <button onClick={trySave} style={btnPrimary}><Check size={15} /> Salvar cliente</button>
        </div>
      </div>
    </div>
  );
}

// Junta tudo que uma administração precisa pra acompanhar corte e estoque:
// quanto já foi cortado, o que está pendente, quem lança mais corte, quais
// modelos puxam mais corte, e onde o estoque pronto está descolado do que
// está em produção (sinal de gargalo).
function computeCutReports(cutBatches, products) {
  const porModelo = {};
  const porTamanho = { P: 0, M: 0, G: 0, GG: 0 };
  const porCortador = {};
  let totalCortado = 0, totalPendente = 0, totalAprovado = 0, totalRejeitado = 0;

  cutBatches.forEach((b) => {
    totalCortado += b.qty;
    if (b.status === "pendente") totalPendente += b.qty;
    if (b.status === "aprovado") totalAprovado += b.qty;
    if (b.status === "rejeitado") totalRejeitado += b.qty;
    if (b.status !== "rejeitado") {
      porModelo[b.model] = (porModelo[b.model] || 0) + b.qty;
      porTamanho[b.size] = (porTamanho[b.size] || 0) + b.qty;
      porCortador[b.cutBy] = (porCortador[b.cutBy] || 0) + b.qty;
    }
  });

  const modelosRanking = Object.entries(porModelo).map(([model, qty]) => ({ model, qty })).sort((a, b) => b.qty - a.qty);
  const cortadoresRanking = Object.entries(porCortador).map(([nome, qty]) => ({ nome, qty })).sort((a, b) => b.qty - a.qty);
  const pendentes = cutBatches.filter((b) => b.status === "pendente").sort((a, b) => new Date(a.cutAt) - new Date(b.cutAt));

  let totalProntaEstoque = 0, totalProducaoEstoque = 0;
  const gargalos = [];
  products.forEach((p) => {
    (p.variants || []).forEach((v) => {
      const pronta = SIZES.reduce((a, s) => a + (v.stock?.[s] || 0), 0);
      const producao = SIZES.reduce((a, s) => a + (v.stockProducao?.[s] || 0), 0);
      totalProntaEstoque += pronta;
      totalProducaoEstoque += producao;
      if (producao > 0) gargalos.push({ model: p.model, color: v.color, pronta, producao });
    });
  });
  gargalos.sort((a, b) => b.producao - a.producao);

  return { totalCortado, totalPendente, totalAprovado, totalRejeitado, modelosRanking, porTamanho, cortadoresRanking, pendentes, totalProntaEstoque, totalProducaoEstoque, gargalos };
}

function RelatoriosCorteAdmin({ cutBatches, products, orders, stockItems }) {
  const [yearFilter, setYearFilter] = useState("all");
  const [monthFilter, setMonthFilter] = useState("all");
  const [limiteBaixo, setLimiteBaixo] = useState(5);
  const [limiteDiasEspera, setLimiteDiasEspera] = useState(7);
  const years = useMemo(() => Array.from(new Set(cutBatches.map((b) => b.cutAt.slice(0, 4)))).sort().reverse(), [cutBatches]);
  const MESES = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];
  const filteredBatches = useMemo(() => cutBatches.filter((b) => {
    if (yearFilter !== "all" && b.cutAt.slice(0, 4) !== yearFilter) return false;
    if (monthFilter !== "all" && b.cutAt.slice(5, 7) !== monthFilter) return false;
    return true;
  }), [cutBatches, yearFilter, monthFilter]);
  const r = useMemo(() => computeCutReports(filteredBatches, products), [filteredBatches, products]);
  const maxModelo = Math.max(1, ...r.modelosRanking.map((m) => m.qty));
  const maxTamanho = Math.max(1, ...Object.values(r.porTamanho));
  const maxCortador = Math.max(1, ...r.cortadoresRanking.map((c) => c.qty));

  // Produtos/cores com pronta entrega abaixo do limite escolhido — pra saber
  // o que lançar corte antes de faltar de vez.
  const estoqueBaixo = useMemo(() => {
    const linhas = [];
    products.forEach((p) => {
      (p.variants || []).forEach((v) => {
        const pronta = SIZES.reduce((a, s) => a + (v.stock?.[s] || 0), 0);
        if (pronta < limiteBaixo) linhas.push({ model: p.model, color: v.color || "(sem nome)", pronta });
      });
    });
    return linhas.sort((a, b) => a.pronta - b.pronta);
  }, [products, limiteBaixo]);

  // Pedidos com item "em produção" ainda sem peça física confirmada o
  // bastante pra cobrir a quantidade comprada — pra cobrar a produção antes
  // do cliente reclamar.
  const pedidosEsperando = useMemo(() => {
    const ativos = (orders || []).filter((o) => o.status !== "Pedido completo" && o.status !== "Pedido cancelado");
    const linhas = [];
    ativos.forEach((o) => {
      (o.items || []).forEach((it) => {
        if (it.stockType !== "producao") return;
        const confirmadas = (stockItems || []).filter((si) => si.orderId === o.id && si.productId === it.productId && si.variantId === it.variantId && si.size === it.size && si.confirmed).length;
        const faltam = it.qty - confirmadas;
        if (faltam > 0) {
          linhas.push({ orderId: o.id, cliente: o.clientName, model: it.model, color: it.color, size: it.size, faltam, dias: Math.floor((Date.now() - new Date(o.date).getTime()) / 86400000) });
        }
      });
    });
    return linhas.sort((a, b) => b.dias - a.dias);
  }, [orders, stockItems]);

  // Do total "em produção" de cada cor/tamanho, tira o que já está reservado
  // pra algum pedido esperando (pedidosEsperando) — o que sobra é o que
  // ainda está disponível pra vender, sem dono ainda.
  const producaoDisponivel = useMemo(() => {
    const reservado = {};
    pedidosEsperando.forEach((e) => {
      const key = `${e.model}·${e.color}·${e.size}`;
      reservado[key] = (reservado[key] || 0) + e.faltam;
    });
    const linhas = [];
    products.forEach((p) => {
      (p.variants || []).forEach((v) => {
        SIZES.forEach((s) => {
          const totalProducao = v.stockProducao?.[s] || 0;
          if (!totalProducao) return;
          const key = `${p.model}·${v.color}·${s}`;
          const disponivel = totalProducao - (reservado[key] || 0);
          if (disponivel > 0) linhas.push({ model: p.model, color: v.color, size: s, disponivel });
        });
      });
    });
    return linhas.sort((a, b) => b.disponivel - a.disponivel);
  }, [products, pedidosEsperando]);

  // Lucro = preço de venda - preço de custo, por pedido, somado no período
  // filtrado (mesmo ano/mês do resto do relatório).
  const lucro = useMemo(() => {
    const inRange = (orders || []).filter((o) => {
      if (o.status === "Pedido cancelado") return false;
      if (yearFilter !== "all" && o.date.slice(0, 4) !== yearFilter) return false;
      if (monthFilter !== "all" && o.date.slice(5, 7) !== monthFilter) return false;
      return true;
    });
    let receita = 0, custo = 0;
    inRange.forEach((o) => (o.items || []).forEach((it) => { receita += (it.price || 0) * it.qty; custo += (it.costPrice || 0) * it.qty; }));
    return { receita, custo, lucro: receita - custo, pedidos: inRange.length };
  }, [orders, yearFilter, monthFilter]);

  function diasDesde(iso) { return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000); }
  function labelMes(m) {
    return new Date(2024, Number(m) - 1, 1).toLocaleDateString("pt-BR", { month: "long" });
  }

  return (
    <div>
      <div style={{ fontFamily: "Georgia, serif", fontSize: 22, color: TOKENS.ink, marginBottom: 4 }}>Relatórios · Estoque e Corte</div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)} style={{ ...inputStyle, width: "auto" }}>
          <option value="all">Todos os anos</option>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)} style={{ ...inputStyle, width: "auto" }}>
          <option value="all">Todos os meses</option>
          {MESES.map((m) => <option key={m} value={m}>{labelMes(m)}</option>)}
        </select>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 24 }}>
        {[
          { label: "Total já cortado", value: r.totalCortado, color: TOKENS.ink },
          { label: "Pendente de aprovação", value: r.totalPendente, color: "#633806" },
          { label: "Em produção (aprovado)", value: r.totalAprovado, color: "#633806" },
          { label: "Pronta entrega (estoque)", value: r.totalProntaEstoque, color: "#27500A" },
          { label: "Recusado", value: r.totalRejeitado, color: "#791F1F" },
        ].map((c) => (
          <div key={c.label} style={{ background: "#fff", border: `1px solid ${TOKENS.line}`, borderRadius: 8, padding: "14px 16px" }}>
            <div style={{ fontSize: 10.5, color: TOKENS.graphite, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 }}>{c.label}</div>
            <div style={{ fontFamily: "Georgia, serif", fontSize: 24, color: c.color }}>{c.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 20, marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: TOKENS.ink, marginBottom: 10 }}>Modelos mais cortados</div>
          {r.modelosRanking.length === 0 ? (
            <div style={{ color: TOKENS.graphite, fontSize: 12.5 }}>Nenhum corte lançado ainda.</div>
          ) : (
            <div style={{ background: "#fff", border: `1px solid ${TOKENS.line}`, borderRadius: 4, overflow: "hidden" }}>
              {r.modelosRanking.slice(0, 8).map((m, i) => (
                <div key={m.model} style={{ padding: "10px 14px", borderBottom: `1px solid ${TOKENS.ivorySoft}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 5 }}>
                    <span><b>{i + 1}.</b> {m.model}</span>
                    <span style={{ color: TOKENS.graphite }}>{m.qty} peça(s)</span>
                  </div>
                  <div style={{ height: 5, background: TOKENS.ivorySoft, borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${(m.qty / maxModelo) * 100}%`, background: TOKENS.wine }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: TOKENS.ink, marginBottom: 10 }}>Corte por tamanho</div>
          <div style={{ background: "#fff", border: `1px solid ${TOKENS.line}`, borderRadius: 4, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
            {SIZES.map((s) => (
              <div key={s}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 4 }}>
                  <span>{s}</span><span style={{ color: TOKENS.graphite }}>{r.porTamanho[s]}</span>
                </div>
                <div style={{ height: 5, background: TOKENS.ivorySoft, borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${(r.porTamanho[s] / maxTamanho) * 100}%`, background: "#BA7517" }} />
                </div>
              </div>
            ))}
          </div>

          <div style={{ fontSize: 13, fontWeight: 600, color: TOKENS.ink, margin: "18px 0 10px" }}>Quem mais lança corte</div>
          <div style={{ background: "#fff", border: `1px solid ${TOKENS.line}`, borderRadius: 4, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
            {r.cortadoresRanking.length === 0 && <div style={{ color: TOKENS.graphite, fontSize: 12.5 }}>Nenhum corte lançado ainda.</div>}
            {r.cortadoresRanking.slice(0, 6).map((c) => (
              <div key={c.nome}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 4 }}>
                  <span>{c.nome}</span><span style={{ color: TOKENS.graphite }}>{c.qty}</span>
                </div>
                <div style={{ height: 5, background: TOKENS.ivorySoft, borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${(c.qty / maxCortador) * 100}%`, background: TOKENS.ink }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: TOKENS.ink, marginBottom: 10 }}>Cortes pendentes de aprovação ({r.pendentes.length})</div>
        {r.pendentes.length === 0 ? (
          <div style={{ color: TOKENS.graphite, fontSize: 12.5 }}>Nenhum corte esperando aprovação. 🎉</div>
        ) : (
          <div style={{ background: "#fff", border: `1px solid ${TOKENS.line}`, borderRadius: 4, overflow: "hidden" }}>
            {r.pendentes.map((b) => {
              const dias = diasDesde(b.cutAt);
              return (
                <div key={b.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderBottom: `1px solid ${TOKENS.ivorySoft}`, fontSize: 12.5 }}>
                  <span>{b.model} · {b.color} · {b.size} — {b.qty} peça(s) · lançado por {b.cutBy}</span>
                  <span style={{ color: dias >= 3 ? "#A5453F" : TOKENS.graphite, fontWeight: dias >= 3 ? 600 : 400 }}>{dias === 0 ? "hoje" : `há ${dias} dia${dias === 1 ? "" : "s"}`}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: TOKENS.ink, marginBottom: 10 }}>Estoque em produção aguardando confirmação (por peça, do maior pro menor)</div>
        {r.gargalos.length === 0 ? (
          <div style={{ color: TOKENS.graphite, fontSize: 12.5 }}>Nada em produção no momento — tudo que foi aprovado já virou pronta entrega.</div>
        ) : (
          <div style={{ background: "#fff", border: `1px solid ${TOKENS.line}`, borderRadius: 4, overflow: "hidden" }}>
            <div style={{ display: "flex", padding: "8px 14px", fontSize: 10.5, color: TOKENS.graphite, textTransform: "uppercase", letterSpacing: 0.4, borderBottom: `1px solid ${TOKENS.line}` }}>
              <span style={{ flex: 1 }}>Modelo · cor</span><span style={{ width: 90, textAlign: "right" }}>Pronta</span><span style={{ width: 110, textAlign: "right" }}>Em produção</span>
            </div>
            {r.gargalos.map((g, i) => (
              <div key={i} style={{ display: "flex", padding: "9px 14px", fontSize: 12.5, borderBottom: `1px solid ${TOKENS.ivorySoft}` }}>
                <span style={{ flex: 1 }}>{g.model} · {g.color}</span>
                <span style={{ width: 90, textAlign: "right", color: g.pronta === 0 ? "#A5453F" : TOKENS.graphite }}>{g.pronta}</span>
                <span style={{ width: 110, textAlign: "right", color: "#633806", fontWeight: 600 }}>{g.producao}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ margin: "24px 0" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: TOKENS.ink, marginBottom: 10 }}>Lucro do período ({lucro.pedidos} pedido{lucro.pedidos === 1 ? "" : "s"})</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
          <div style={{ background: "#fff", border: `1px solid ${TOKENS.line}`, borderRadius: 8, padding: "14px 16px" }}>
            <div style={{ fontSize: 10.5, color: TOKENS.graphite, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 }}>Receita</div>
            <div style={{ fontFamily: "Georgia, serif", fontSize: 22, color: TOKENS.ink }}>R$ {formatBRL(lucro.receita)}</div>
          </div>
          <div style={{ background: "#fff", border: `1px solid ${TOKENS.line}`, borderRadius: 8, padding: "14px 16px" }}>
            <div style={{ fontSize: 10.5, color: TOKENS.graphite, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 }}>Custo</div>
            <div style={{ fontFamily: "Georgia, serif", fontSize: 22, color: TOKENS.graphite }}>R$ {formatBRL(lucro.custo)}</div>
          </div>
          <div style={{ background: "#fff", border: `1px solid ${TOKENS.line}`, borderRadius: 8, padding: "14px 16px" }}>
            <div style={{ fontSize: 10.5, color: TOKENS.graphite, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 }}>Lucro</div>
            <div style={{ fontFamily: "Georgia, serif", fontSize: 22, color: lucro.lucro >= 0 ? "#27500A" : "#A5453F" }}>R$ {formatBRL(lucro.lucro)}</div>
          </div>
        </div>
        {lucro.custo === 0 && lucro.receita > 0 && <div style={{ fontSize: 11, color: TOKENS.graphite, marginTop: 6 }}>Se o custo aparecer zerado, é porque os produtos desse período não têm preço de custo cadastrado em Produtos & Estoque.</div>}
      </div>

      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: TOKENS.ink }}>Estoque baixo (pronta entrega abaixo de</div>
          <input type="number" min={0} value={limiteBaixo} onChange={(e) => setLimiteBaixo(Math.max(0, Number(e.target.value) || 0))} style={{ ...inputStyle, width: 60, padding: "4px 8px" }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: TOKENS.ink }}>peças)</span>
        </div>
        {estoqueBaixo.length === 0 ? (
          <div style={{ color: TOKENS.graphite, fontSize: 12.5 }}>Nenhuma cor abaixo desse limite. 🎉</div>
        ) : (
          <div style={{ background: "#fff", border: `1px solid ${TOKENS.line}`, borderRadius: 4, overflow: "hidden" }}>
            {estoqueBaixo.map((e, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "9px 14px", fontSize: 12.5, borderBottom: `1px solid ${TOKENS.ivorySoft}` }}>
                <span>{e.model} · {e.color}</span>
                <span style={{ fontWeight: 600, color: e.pronta === 0 ? "#A5453F" : "#633806" }}>{e.pronta === 0 ? "esgotado" : `${e.pronta} peça(s)`}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: TOKENS.ink }}>Pedidos esperando produção ({pedidosEsperando.length})</div>
          <div style={{ fontSize: 11.5, color: TOKENS.graphite }}>destacar em vermelho após <input type="number" min={0} value={limiteDiasEspera} onChange={(e) => setLimiteDiasEspera(Math.max(0, Number(e.target.value) || 0))} style={{ ...inputStyle, width: 44, padding: "3px 6px", display: "inline-block" }} /> dias</div>
        </div>
        {pedidosEsperando.length === 0 ? (
          <div style={{ color: TOKENS.graphite, fontSize: 12.5 }}>Nenhum pedido esperando peça em produção. 🎉</div>
        ) : (
          <div style={{ background: "#fff", border: `1px solid ${TOKENS.line}`, borderRadius: 4, overflow: "hidden" }}>
            {pedidosEsperando.map((e, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 14px", fontSize: 12.5, borderBottom: `1px solid ${TOKENS.ivorySoft}` }}>
                <span>{e.model} · {e.color} · {e.size} — {e.faltam} peça(s) · pedido de {e.cliente}</span>
                <span style={{ color: e.dias >= limiteDiasEspera ? "#A5453F" : TOKENS.graphite, fontWeight: e.dias >= limiteDiasEspera ? 600 : 400 }}>{e.dias === 0 ? "hoje" : `há ${e.dias} dia${e.dias === 1 ? "" : "s"}`}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ marginTop: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: TOKENS.ink, marginBottom: 10 }}>Em produção, ainda sem comprador ({producaoDisponivel.length})</div>
        {producaoDisponivel.length === 0 ? (
          <div style={{ color: TOKENS.graphite, fontSize: 12.5 }}>Tudo que está em produção já tem pedido esperando, ou não há nada em produção agora.</div>
        ) : (
          <div style={{ background: "#fff", border: `1px solid ${TOKENS.line}`, borderRadius: 4, overflow: "hidden" }}>
            {producaoDisponivel.map((e, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "9px 14px", fontSize: 12.5, borderBottom: `1px solid ${TOKENS.ivorySoft}` }}>
                <span>{e.model} · {e.color} · {e.size}</span>
                <span style={{ fontWeight: 600, color: "#633806" }}>{e.disponivel} peça(s)</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CatalogoModelosAdmin({ settings, setSettings, products, setProducts, cutBatches, persistCutBatches, stockItems, setStockItems }) {
  const categories = settings.categories || DEFAULT_CATEGORIES;
  const [novaCategoria, setNovaCategoria] = useState("");
  const colors = settings.colors || [];
  const [novaCorNome, setNovaCorNome] = useState("");
  const [novaCorHex, setNovaCorHex] = useState("#7A2E38");

  // Grupos de categoria (ex: POLIAMIDA, AVELUDADO, CANELADO, JACQUARD) usados
  // como filtro de duas camadas na vitrine: grupo (tecido/linha) > categoria
  // (subcategoria, o item em si). Cada categoria pertence a no máximo um
  // grupo; a que não tiver grupo aparece em "Outras" na vitrine.
  const categoryGroups = settings.categoryGroups || {};
  const grupoNomes = Object.keys(categoryGroups);
  const [novoGrupo, setNovoGrupo] = useState("");

  function grupoDaCategoria(cat) {
    return grupoNomes.find((g) => (categoryGroups[g] || []).includes(cat)) || "";
  }
  function addGrupo() {
    const nome = novoGrupo.trim().toUpperCase();
    if (!nome) return;
    if (categoryGroups[nome]) { alert("Esse grupo já existe."); return; }
    setSettings({ ...settings, categoryGroups: { ...categoryGroups, [nome]: [] } });
    setNovoGrupo("");
  }
  function removeGrupo(nome) {
    if (!confirm(`Remover o grupo "${nome}"? As categorias dele voltam a aparecer em "Outras" na vitrine.`)) return;
    const next = { ...categoryGroups };
    delete next[nome];
    setSettings({ ...settings, categoryGroups: next });
  }
  function setCategoriaGrupo(cat, novoNomeGrupo) {
    const next = {};
    grupoNomes.forEach((g) => { next[g] = (categoryGroups[g] || []).filter((c) => c !== cat); });
    if (novoNomeGrupo) next[novoNomeGrupo] = [...(next[novoNomeGrupo] || []), cat];
    setSettings({ ...settings, categoryGroups: next });
  }

  function addCategoria() {
    const nome = novaCategoria.trim();
    if (!nome) return;
    if (categories.some((c) => c.toLowerCase() === nome.toLowerCase())) { alert("Essa categoria já existe."); return; }
    setSettings({ ...settings, categories: [...categories, nome] });
    setNovaCategoria("");
  }
  function removeCategoria(nome) {
    if (!confirm(`Remover a categoria "${nome}"? Produtos que já usam ela continuam com essa categoria — só não aparece mais pra escolher em produtos novos.`)) return;
    setSettings({ ...settings, categories: categories.filter((c) => c !== nome) });
  }

  const [editingCategoria, setEditingCategoria] = useState(null);
  const [editCategoriaNome, setEditCategoriaNome] = useState("");
  const [salvandoCategoria, setSalvandoCategoria] = useState(false);

  function startEditCategoria(nome) {
    setEditingCategoria(nome);
    setEditCategoriaNome(nome);
  }

  // Edita o nome da categoria e já atualiza em todo produto que já usa ela,
  // mesmo tratamento que demos pras cores.
  async function saveEditCategoria() {
    const nomeOriginal = editingCategoria;
    const novoNome = editCategoriaNome.trim().toUpperCase();
    if (!novoNome) { alert("O nome da categoria não pode ficar vazio."); return; }
    if (novoNome !== nomeOriginal.toUpperCase() && categories.some((c) => c.toUpperCase() === novoNome)) {
      alert("Já existe uma categoria com esse nome.");
      return;
    }
    setSalvandoCategoria(true);
    try {
      await setSettings({ ...settings, categories: categories.map((c) => c === nomeOriginal ? novoNome : c) });
      const afetados = products.filter((p) => p.category === nomeOriginal);
      if (afetados.length) {
        await setProducts(products.map((p) => p.category === nomeOriginal ? { ...p, category: novoNome } : p));
      }
      setEditingCategoria(null);
    } finally { setSalvandoCategoria(false); }
  }

  function addCor() {
    const nome = novaCorNome.trim();
    if (!nome) return;
    if (colors.some((c) => c.name.toLowerCase() === nome.toLowerCase())) { alert("Essa cor já existe no catálogo."); return; }
    setSettings({ ...settings, colors: [...colors, { name: nome, hex: novaCorHex }] });
    setNovaCorNome(""); setNovaCorHex("#7A2E38");
  }
  function removeCor(nome) {
    if (!confirm(`Remover "${nome}" do catálogo de cores? Produtos que já usam essa cor continuam normalmente — só não aparece mais pra escolher em novos lançamentos.`)) return;
    setSettings({ ...settings, colors: colors.filter((c) => c.name !== nome) });
  }

  const [editingCor, setEditingCor] = useState(null); // nome da cor sendo editada
  const [editNome, setEditNome] = useState("");
  const [editHex, setEditHex] = useState("#7A2E38");
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);

  function startEditCor(c) {
    setEditingCor(c.name);
    setEditNome(c.name);
    setEditHex(c.hex);
  }

  // Edita a cor no catálogo E já atualiza em todo lugar que já usa ela
  // (produtos, cortes lançados, peças numeradas) — assim o ajuste de tom ou
  // nome vale pra tudo de uma vez, não só pras próximas escolhas.
  async function saveEditCor() {
    const nomeOriginal = editingCor;
    const novoNome = editNome.trim().toUpperCase();
    if (!novoNome) { alert("O nome da cor não pode ficar vazio."); return; }
    if (novoNome !== nomeOriginal.toUpperCase() && colors.some((c) => c.name.toUpperCase() === novoNome)) {
      alert("Já existe uma cor com esse nome no catálogo.");
      return;
    }
    setSalvandoEdicao(true);
    try {
      await setSettings({ ...settings, colors: colors.map((c) => c.name === nomeOriginal ? { name: novoNome, hex: editHex } : c) });

      const nextProducts = products.map((p) => ({
        ...p,
        variants: p.variants.map((v) => v.color?.toUpperCase() === nomeOriginal.toUpperCase() ? { ...v, color: novoNome, hex: editHex } : v),
      }));
      await setProducts(nextProducts);

      const batchesAfetados = cutBatches.filter((b) => b.color?.toUpperCase() === nomeOriginal.toUpperCase());
      if (batchesAfetados.length) {
        await persistCutBatches(cutBatches.map((b) => b.color?.toUpperCase() === nomeOriginal.toUpperCase() ? { ...b, color: novoNome } : b));
      }

      const itensAfetados = stockItems.filter((si) => si.color?.toUpperCase() === nomeOriginal.toUpperCase());
      if (itensAfetados.length) {
        await setStockItems(stockItems.map((si) => si.color?.toUpperCase() === nomeOriginal.toUpperCase() ? { ...si, color: novoNome, hex: editHex } : si));
      }

      setEditingCor(null);
    } finally { setSalvandoEdicao(false); }
  }

  return (
    <div style={{ maxWidth: 460 }}>
      <div style={{ fontFamily: "Georgia, serif", fontSize: 22, color: TOKENS.ink, marginBottom: 4 }}>Catálogo de Modelos</div>
      <div style={{ fontSize: 12, color: TOKENS.graphite, marginBottom: 18 }}>Categorias usadas ao cadastrar produtos e lançar cortes. Crie uma nova se precisar.</div>
      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        <input value={novaCategoria} onChange={(e) => setNovaCategoria(e.target.value.toUpperCase())} placeholder="Nova categoria" style={inputStyle} onKeyDown={(e) => e.key === "Enter" && addCategoria()} />
        <button onClick={addCategoria} style={btnPrimary}><Plus size={14} /> Adicionar</button>
      </div>
      <div style={{ background: "#fff", border: `1px solid ${TOKENS.line}`, borderRadius: 4, overflow: "hidden", marginBottom: 28 }}>
        {categories.map((c) => (
          <div key={c} style={{ borderBottom: `1px solid ${TOKENS.ivorySoft}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px" }}>
              <span style={{ fontSize: 13.5, color: TOKENS.ink }}>{c}</span>
              <div style={{ display: "flex", gap: 4 }}>
                <button onClick={() => startEditCategoria(c)} style={iconBtnStyle}><Pencil size={14} color={TOKENS.graphite} /></button>
                <button onClick={() => removeCategoria(c)} style={iconBtnStyle}><Trash2 size={15} color="#A5453F" /></button>
              </div>
            </div>
            {editingCategoria === c && (
              <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "0 14px 12px" }}>
                <input value={editCategoriaNome} onChange={(e) => setEditCategoriaNome(e.target.value.toUpperCase())} style={{ ...inputStyle, flex: 1 }} onKeyDown={(e) => e.key === "Enter" && saveEditCategoria()} />
                <button onClick={saveEditCategoria} disabled={salvandoCategoria} style={{ ...btnPrimary, padding: "6px 12px", fontSize: 12 }}><Check size={13} /> {salvandoCategoria ? "Salvando..." : "Salvar"}</button>
                <button onClick={() => setEditingCategoria(null)} style={btnGhostSmall}>Cancelar</button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{ fontFamily: "Georgia, serif", fontSize: 18, color: TOKENS.ink, marginBottom: 4 }}>Grupos de categoria (filtro da vitrine)</div>
      <div style={{ fontSize: 12, color: TOKENS.graphite, marginBottom: 18 }}>Organize as categorias em grupos (ex: POLIAMIDA, AVELUDADO, CANELADO, JACQUARD). Na vitrine, o cliente filtra primeiro pelo grupo e depois pela categoria dentro dele. Categoria sem grupo aparece em "Outras".</div>
      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        <input value={novoGrupo} onChange={(e) => setNovoGrupo(e.target.value.toUpperCase())} placeholder="Novo grupo (ex: POLIAMIDA)" style={inputStyle} onKeyDown={(e) => e.key === "Enter" && addGrupo()} />
        <button onClick={addGrupo} style={btnPrimary}><Plus size={14} /> Adicionar</button>
      </div>

      {grupoNomes.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
          {grupoNomes.map((g) => (
            <div key={g} style={{ display: "flex", alignItems: "center", gap: 6, background: TOKENS.ivorySoft, border: `1px solid ${TOKENS.line}`, borderRadius: 16, padding: "5px 6px 5px 12px", fontSize: 12.5 }}>
              <span>{g}</span>
              <span style={{ color: TOKENS.graphite, fontSize: 11 }}>({(categoryGroups[g] || []).length})</span>
              <button onClick={() => removeGrupo(g)} style={{ ...iconBtnStyle, width: 20, height: 20 }}><Trash2 size={12} color="#A5453F" /></button>
            </div>
          ))}
        </div>
      )}

      <div style={{ background: "#fff", border: `1px solid ${TOKENS.line}`, borderRadius: 4, overflow: "hidden", marginBottom: 28 }}>
        {categories.length === 0 && <div style={{ padding: 14, fontSize: 12.5, color: TOKENS.graphite }}>Cadastre categorias acima para poder agrupá-las.</div>}
        {categories.map((c) => (
          <div key={c} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "9px 14px", borderBottom: `1px solid ${TOKENS.ivorySoft}` }}>
            <span style={{ fontSize: 12.5, color: TOKENS.ink }}>{c}</span>
            <select value={grupoDaCategoria(c)} onChange={(e) => setCategoriaGrupo(c, e.target.value)} style={{ ...inputStyle, width: "auto", padding: "5px 8px", fontSize: 12 }}>
              <option value="">Sem grupo (Outras)</option>
              {grupoNomes.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
        ))}
      </div>

      <div style={{ fontFamily: "Georgia, serif", fontSize: 18, color: TOKENS.ink, marginBottom: 4 }}>Catálogo de Cores</div>
      <div style={{ fontSize: 12, color: TOKENS.graphite, marginBottom: 18 }}>Cores reutilizáveis ao lançar corte ou cadastrar produto direto — assim não precisa digitar o nome nem escolher o tom de novo. Cores novas digitadas em qualquer uma das duas telas já entram aqui sozinhas. Editar uma cor aqui já atualiza o nome/tom em todos os produtos, cortes e peças que já usam ela.</div>
      <div style={{ display: "flex", gap: 8, marginBottom: 18, alignItems: "center" }}>
        <input value={novaCorNome} onChange={(e) => setNovaCorNome(e.target.value.toUpperCase())} placeholder="Nova cor" style={inputStyle} onKeyDown={(e) => e.key === "Enter" && addCor()} />
        <input type="color" value={novaCorHex} onChange={(e) => setNovaCorHex(e.target.value)} style={{ width: 40, height: 40, border: "none", padding: 0, background: "none", cursor: "pointer", borderRadius: "50%", flexShrink: 0 }} />
        <button onClick={addCor} style={btnPrimary}><Plus size={14} /> Adicionar</button>
      </div>
      <div style={{ background: "#fff", border: `1px solid ${TOKENS.line}`, borderRadius: 4, overflow: "hidden" }}>
        {colors.length === 0 && <div style={{ padding: 14, fontSize: 12.5, color: TOKENS.graphite }}>Nenhuma cor cadastrada ainda.</div>}
        {colors.map((c) => (
          <div key={c.name} style={{ borderBottom: `1px solid ${TOKENS.ivorySoft}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 18, height: 18, borderRadius: "50%", background: c.hex, border: `1px solid ${TOKENS.line}`, display: "inline-block" }} />
                <span style={{ fontSize: 13.5, color: TOKENS.ink }}>{c.name}</span>
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                <button onClick={() => startEditCor(c)} style={iconBtnStyle}><Pencil size={14} color={TOKENS.graphite} /></button>
                <button onClick={() => removeCor(c.name)} style={iconBtnStyle}><Trash2 size={15} color="#A5453F" /></button>
              </div>
            </div>
            {editingCor === c.name && (
              <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "0 14px 12px" }}>
                <input value={editNome} onChange={(e) => setEditNome(e.target.value.toUpperCase())} style={{ ...inputStyle, flex: 1 }} onKeyDown={(e) => e.key === "Enter" && saveEditCor()} />
                <input type="color" value={editHex} onChange={(e) => setEditHex(e.target.value)} style={{ width: 36, height: 36, border: "none", padding: 0, background: "none", cursor: "pointer", borderRadius: "50%", flexShrink: 0 }} />
                <button onClick={saveEditCor} disabled={salvandoEdicao} style={{ ...btnPrimary, padding: "6px 12px", fontSize: 12 }}><Check size={13} /> {salvandoEdicao ? "Salvando..." : "Salvar"}</button>
                <button onClick={() => setEditingCor(null)} style={btnGhostSmall}>Cancelar</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ColetaEstoqueAdmin({ orders, products, stockItems, settings, cutBatches, lancarCorte, garantirProdutoVariante, persistProducts, aprovarCorte, rejeitarCorte, excluirCortes, garantirCorNoCatalogo, scanReceiveStock, scanCollectOrder, updateStatus, session }) {
  const [mode, setMode] = useState("menu");
  const [activeOrder, setActiveOrder] = useState(null);
  const canApprove = session?.role === "admin" || session?.role === "admincentral";
  const pendentes = cutBatches.filter((b) => b.status === "pendente").length;

  if (mode === "receber") return <ReceberEstoqueView scanReceiveStock={scanReceiveStock} onBack={() => setMode("menu")} />;
  if (mode === "coletar-lista") return <ColetarPedidoLista orders={orders} onSelect={(o) => { setActiveOrder(o); setMode("coletar-pedido"); }} onView={(o) => { setActiveOrder(o); setMode("ver-pedido"); }} onBack={() => setMode("menu")} />;
  if (mode === "coletar-pedido") return <ColetarPedidoView order={activeOrder} orders={orders} scanCollectOrder={scanCollectOrder} updateStatus={updateStatus} session={session} onBack={() => setMode("coletar-lista")} />;
  if (mode === "ver-pedido") return <PedidoColetadoDetalhe order={orders.find((o) => o.id === activeOrder?.id) || activeOrder} onBack={() => setMode("coletar-lista")} />;
  if (mode === "lancar-corte") return <LancarCorteView products={products} categories={settings.categories || DEFAULT_CATEGORIES} colors={settings.colors || []} garantirCorNoCatalogo={garantirCorNoCatalogo} lancarCorte={lancarCorte} persistProducts={persistProducts} onBack={() => setMode("menu")} />;
  if (mode === "cortes") return <CortesAdmin cutBatches={cutBatches} products={products} stockItems={stockItems} aprovarCorte={aprovarCorte} rejeitarCorte={rejeitarCorte} excluirCortes={excluirCortes} canApprove={canApprove} onBack={() => setMode("menu")} />;

  return (
    <div>
      <div style={{ fontFamily: "Georgia, serif", fontSize: 22, color: TOKENS.ink, marginBottom: 16 }}>Coleta e Estoque</div>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <button onClick={() => setMode("receber")} style={{ flex: "1 1 240px", background: "#fff", border: `1px solid ${TOKENS.line}`, borderRadius: 8, padding: 24, textAlign: "left", cursor: "pointer" }}>
          <ScanBarcode size={22} color={TOKENS.wine} />
          <div style={{ fontSize: 15, fontWeight: 600, margin: "10px 0 4px" }}>Receber estoque</div>
          <div style={{ fontSize: 12.5, color: TOKENS.graphite }}>Bipe as peças prontas — confirma a saída da produção para pronta entrega.</div>
        </button>
        <button onClick={() => setMode("coletar-lista")} style={{ flex: "1 1 240px", background: "#fff", border: `1px solid ${TOKENS.line}`, borderRadius: 8, padding: 24, textAlign: "left", cursor: "pointer" }}>
          <ScanBarcode size={22} color={TOKENS.wine} />
          <div style={{ fontSize: 15, fontWeight: 600, margin: "10px 0 4px" }}>Coletar pedido</div>
          <div style={{ fontSize: 12.5, color: TOKENS.graphite }}>Escolha um pedido e bipe as peças para separar.</div>
        </button>
        <button onClick={() => setMode("lancar-corte")} style={{ flex: "1 1 240px", background: "#fff", border: `1px solid ${TOKENS.line}`, borderRadius: 8, padding: 24, textAlign: "left", cursor: "pointer" }}>
          <Scissors size={22} color={TOKENS.wine} />
          <div style={{ fontSize: 15, fontWeight: 600, margin: "10px 0 4px" }}>Lançar corte</div>
          <div style={{ fontSize: 12.5, color: TOKENS.graphite }}>Registre um corte feito — fica em produção até aprovação.</div>
        </button>
        <button onClick={() => setMode("cortes")} style={{ flex: "1 1 240px", background: "#fff", border: `1px solid ${TOKENS.line}`, borderRadius: 8, padding: 24, textAlign: "left", cursor: "pointer", position: "relative" }}>
          {pendentes > 0 && <span style={{ position: "absolute", top: 14, right: 14, background: TOKENS.wine, color: "#fff", fontSize: 11, fontWeight: 700, borderRadius: 12, padding: "2px 8px" }}>{pendentes}</span>}
          <Scissors size={22} color={TOKENS.wine} />
          <div style={{ fontSize: 15, fontWeight: 600, margin: "10px 0 4px" }}>Cortes lançados</div>
          <div style={{ fontSize: 12.5, color: TOKENS.graphite }}>{canApprove ? "Aprove ou recuse os cortes pendentes." : "Veja o status dos cortes que você lançou."}</div>
        </button>
      </div>
    </div>
  );
}

function ReceberEstoqueView({ scanReceiveStock, onBack }) {
  const [code, setCode] = useState("");
  const [log, setLog] = useState([]);
  const [lastUndo, setLastUndo] = useState(null);
  const inputRef = useRef();
  useEffect(() => { inputRef.current?.focus(); }, []);

  function handleSubmit(e) {
    e.preventDefault();
    if (!code.trim()) return;
    const result = scanReceiveStock(code.trim());
    setLog((l) => [{ ...result, code: code.trim() }, ...l].slice(0, 40));
    setLastUndo(result.ok && result.undo ? { undo: result.undo, label: code.trim() } : null);
    setCode("");
    setTimeout(() => inputRef.current?.focus(), 0);
  }
  function handleUndo() {
    if (!lastUndo) return;
    lastUndo.undo();
    setLog((l) => [{ ok: true, code: lastUndo.label, message: `Bipe de ${lastUndo.label} desfeito.` }, ...l].slice(0, 40));
    setLastUndo(null);
  }

  return (
    <div>
      <button onClick={onBack} style={btnGhostSmall}><ChevronLeft size={13} /> Voltar</button>
      <div style={{ fontFamily: "Georgia, serif", fontSize: 20, margin: "12px 0" }}>Receber estoque</div>
      <div style={{ fontSize: 12, color: TOKENS.graphite, marginBottom: 14 }}>Bipe cada peça que chegou — cada leitura soma 1 unidade no estoque daquele tamanho/cor.</div>
      <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <input ref={inputRef} value={code} onChange={(e) => setCode(e.target.value)} placeholder="Bipe o código aqui" style={{ ...inputStyle, flex: 1 }} autoFocus />
        <button type="submit" style={btnPrimary}>Confirmar</button>
      </form>
      {lastUndo && (
        <button onClick={handleUndo} style={{ ...btnGhostSmall, marginBottom: 16 }}><X size={13} /> Desfazer último bipe ({lastUndo.label})</button>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 420, overflowY: "auto" }}>
        {log.map((l, i) => (
          l.alreadyReceived ? (
            <div key={i} style={{ padding: "12px 14px", borderRadius: 4, background: "#FCEBEB", color: "#791F1F", fontSize: 16, fontWeight: 700, border: "1px solid #F09595" }}>
              ATENÇÃO. {l.message}
            </div>
          ) : l.reservedForOrder ? (
            <div key={i} style={{ padding: "12px 14px", borderRadius: 4, background: "#FAEEDA", color: "#633806", fontSize: 16, fontWeight: 700, border: "1px solid #EF9F27" }}>
              JÁ VENDIDA. {l.message}
            </div>
          ) : (
            <div key={i} style={{ padding: "8px 12px", borderRadius: 4, background: l.ok ? "#EAF3DE" : "#FCEBEB", color: l.ok ? "#27500A" : "#791F1F", fontSize: 12.5 }}>
              <b style={{ fontFamily: "monospace" }}>{l.code}</b> — {l.message}
            </div>
          )
        ))}
      </div>
    </div>
  );
}

function ColetarPedidoLista({ orders, onSelect, onView, onBack }) {
  const relevant = orders.filter((o) => o.status !== "Pedido cancelado").slice().reverse();
  const withProgress = relevant.map((o) => {
    const total = o.items.reduce((a, it) => a + it.qty, 0);
    const collected = o.items.reduce((a, it) => a + (it.collected || 0), 0);
    return { order: o, total, collected };
  });
  const novos = withProgress.filter((x) => x.order.status !== "Pedido completo" && x.collected === 0);
  const emAberto = withProgress.filter((x) => x.order.status !== "Pedido completo" && x.collected > 0 && x.collected < x.total);
  const coletados = withProgress.filter((x) => x.order.status === "Pedido completo");

  function Section({ title, list, onClickRow }) {
    return (
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: TOKENS.graphite, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>{title} ({list.length})</div>
        <div style={{ background: "#fff", border: `1px solid ${TOKENS.line}`, borderRadius: 4, overflow: "hidden" }}>
          {list.length === 0 && <div style={{ padding: 16, fontSize: 12.5, color: TOKENS.graphite }}>Nenhum pedido aqui.</div>}
          {list.map(({ order: o, total, collected }) => (
            <button key={o.id} onClick={() => onClickRow(o)} style={{ width: "100%", textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", borderBottom: `1px solid ${TOKENS.ivorySoft}`, background: "none", border: "none", cursor: "pointer" }}>
              <div>
                <div style={{ fontSize: 13.5, color: TOKENS.ink }}>{o.clientName}</div>
                <div style={{ fontSize: 11, color: TOKENS.graphite }}>{new Date(o.date).toLocaleDateString("pt-BR")} · {o.status}</div>
              </div>
              <div style={{ fontSize: 12, color: collected === total ? TOKENS.ok : TOKENS.graphite }}>{collected} de {total} coletados</div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <button onClick={onBack} style={btnGhostSmall}><ChevronLeft size={13} /> Voltar</button>
      <div style={{ fontFamily: "Georgia, serif", fontSize: 20, margin: "12px 0 18px" }}>Pedidos</div>
      <Section title="Pedidos novos (nada coletado ainda)" list={novos} onClickRow={onSelect} />
      <Section title="Pedidos em aberto (coleta em andamento)" list={emAberto} onClickRow={onSelect} />
      <Section title="Pedidos coletados" list={coletados} onClickRow={onView} />
    </div>
  );
}

function PedidoColetadoDetalhe({ order, onBack }) {
  if (!order) return <div><button onClick={onBack} style={btnGhostSmall}><ChevronLeft size={13} /> Voltar</button></div>;
  const total = order.items.reduce((a, it) => a + it.qty, 0);
  return (
    <div>
      <button onClick={onBack} style={btnGhostSmall}><ChevronLeft size={13} /> Voltar</button>
      <div style={{ margin: "12px 0 4px" }}>
        <div style={{ fontSize: 12, color: TOKENS.graphite }}>Pedido coletado de</div>
        <div style={{ fontFamily: "Georgia, serif", fontSize: 19 }}>{order.clientName}</div>
      </div>
      <div style={{ fontSize: 12, color: TOKENS.graphite, marginBottom: 4 }}>Pedido feito em {new Date(order.date).toLocaleString("pt-BR")}</div>
      {order.collectedBy && (
        <div style={{ fontSize: 12.5, color: TOKENS.ok, fontWeight: 600, marginBottom: 18 }}>
          Coletado por {order.collectedBy}{order.collectedAt ? ` · ${new Date(order.collectedAt).toLocaleString("pt-BR")}` : ""}
        </div>
      )}
      {order.note && <div style={{ fontSize: 12.5, color: "#633806", background: "#FAEEDA", padding: "8px 12px", borderRadius: 4, marginBottom: 18 }}><b>Observações:</b> {order.note}</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {order.items.map((it, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, background: "#fff", border: `1px solid ${TOKENS.line}`, borderRadius: 8, padding: "10px 14px" }}>
            {it.image ? <img src={it.image} style={{ width: 40, height: 52, objectFit: "cover", borderRadius: 3, flexShrink: 0 }} /> : <div style={{ width: 40, height: 52, background: TOKENS.ivorySoft, borderRadius: 3, flexShrink: 0 }} />}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: TOKENS.ink }}>{it.model} · {it.color} · {it.size}</div>
              <div style={{ fontSize: 11.5, color: TOKENS.graphite }}>{it.qty} peça(s) · R$ {formatBRL(parseBRL(it.price) * it.qty)}{it.sku ? ` · SKU ${it.sku}` : ""}</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16, fontSize: 14, fontWeight: 600 }}>
        <span>Total: {total} peça(s)</span>
        <span style={{ color: TOKENS.wine }}>R$ {formatBRL(order.items.reduce((a, it) => a + parseBRL(it.price) * it.qty, 0))}</span>
      </div>
    </div>
  );
}

function ColetarPedidoView({ order: initialOrder, orders, scanCollectOrder, updateStatus, session, onBack }) {
  const order = orders.find((o) => o.id === initialOrder.id) || initialOrder;
  const [code, setCode] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [printing, setPrinting] = useState(false);
  const [lastUndo, setLastUndo] = useState(null);
  const inputRef = useRef();
  useEffect(() => { inputRef.current?.focus(); }, [order.id]);

  const allComplete = order.items.every((it) => (it.collected || 0) >= it.qty);

  function handleSubmit(e) {
    e.preventDefault();
    if (!code.trim()) return;
    const result = scanCollectOrder(order, code.trim());
    setFeedback(result);
    setLastUndo(result.ok && result.undo ? { undo: result.undo, label: code.trim() } : null);
    setCode("");
    // Um pequeno atraso garante que o campo já esteja liberado de novo pro
    // próximo bip, mesmo logo depois de uma mensagem de erro aparecer.
    setTimeout(() => inputRef.current?.focus(), 0);
  }
  function handleUndo() {
    if (!lastUndo) return;
    lastUndo.undo();
    setFeedback({ ok: true, message: `Bipe de ${lastUndo.label} desfeito.` });
    setLastUndo(null);
  }

  function confirm() {
    updateStatus(order.id, "Pedido completo", {
      collectedBy: session?.name || session?.username,
      collectedAt: new Date().toISOString(),
    });
    onBack();
  }

  async function printOrder() {
    setPrinting(true);
    try {
      const blob = await buildOrderPdfBlob(order.items, { name: order.sellerName, username: order.sellerUsername }, false, { buyerName: order.clientName }, order.note);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `pedido-${order.clientName.replace(/\s+/g, "-").toLowerCase()}-${order.id}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert("Não foi possível gerar o PDF agora. Tente novamente em alguns segundos.");
    } finally { setPrinting(false); }
  }

  return (
    <div>
      <button onClick={onBack} style={btnGhostSmall}><ChevronLeft size={13} /> Voltar</button>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", margin: "12px 0" }}>
        <div>
          <div style={{ fontSize: 12, color: TOKENS.graphite }}>Coletando pedido de</div>
          <div style={{ fontFamily: "Georgia, serif", fontSize: 19 }}>{order.clientName}</div>
        </div>
        <button onClick={printOrder} disabled={printing} style={btnGhostSmall}><Printer size={13} /> {printing ? "Gerando..." : "Imprimir pedido"}</button>
      </div>
      {order.note && <div style={{ fontSize: 12.5, color: "#633806", background: "#FAEEDA", padding: "8px 12px", borderRadius: 4, marginBottom: 10 }}><b>Observações:</b> {order.note}</div>}
      <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <input ref={inputRef} value={code} onChange={(e) => setCode(e.target.value)} placeholder="Bipe o código aqui" style={{ ...inputStyle, flex: 1 }} autoFocus />
        <button type="submit" style={btnPrimary}>OK</button>
      </form>
      {lastUndo && (
        <button onClick={handleUndo} style={{ ...btnGhostSmall, marginBottom: 10 }}><X size={13} /> Desfazer último bipe ({lastUndo.label})</button>
      )}
      {feedback && (
        feedback.alreadyComplete ? (
          <div style={{ padding: "12px 14px", borderRadius: 4, marginBottom: 14, fontSize: 16, fontWeight: 700, background: "#FCEBEB", color: "#791F1F", border: "1px solid #F09595" }}>
            ATENÇÃO. Já foi completo essa referência.
          </div>
        ) : feedback.duplicatePiece ? (
          <div style={{ padding: "12px 14px", borderRadius: 4, marginBottom: 14, fontSize: 16, fontWeight: 700, background: "#FCEBEB", color: "#791F1F", border: "1px solid #F09595" }}>
            ATENÇÃO. {feedback.message}
          </div>
        ) : (
          <div style={{ padding: "8px 12px", borderRadius: 4, marginBottom: 14, fontSize: 12.5, background: feedback.ok ? "#EAF3DE" : "#FCEBEB", color: feedback.ok ? "#27500A" : "#791F1F" }}>{feedback.message}</div>
        )
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {order.items.map((it, i) => {
          const collected = it.collected || 0;
          const complete = collected >= it.qty;
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, background: "#fff", border: `1px solid ${complete ? "#97C459" : "#F09595"}`, borderRadius: 8, padding: "10px 14px" }}>
              <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 3, background: complete ? "#EAF3DE" : "#FCEBEB", color: complete ? "#27500A" : "#791F1F", whiteSpace: "nowrap" }}>{complete ? "Completo" : "Faltando"}</span>
              <div style={{ width: 40, height: 50, borderRadius: 4, background: TOKENS.ivorySoft, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                {it.image ? <img src={it.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <ImageIcon size={16} color={TOKENS.line} />}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: TOKENS.ink }}>{it.model} · {it.color} · {it.size}</div>
                <div style={{ fontSize: 11.5, color: TOKENS.graphite }}>{collected} de {it.qty} coletadas{it.sku ? ` · SKU ${it.sku}` : ""}</div>
              </div>
            </div>
          );
        })}
      </div>
      <button onClick={confirm} disabled={!allComplete} style={{ ...btnPrimary, width: "100%", justifyContent: "center", marginTop: 16, opacity: allComplete ? 1 : 0.5, cursor: allComplete ? "pointer" : "not-allowed" }}>
        <Check size={15} /> {allComplete ? "Confirmar coleta" : "Falta completar todos os itens"}
      </button>
    </div>
  );
}

// Select próprio pra cor — o <select> nativo do navegador não deixa colorir
// dentro da lista de opções, só o valor escolhido. Esse aqui mostra a
// bolinha em CADA item da lista, com borda sempre visível (importante pra
// cores claras, tipo branco, não sumirem contra o fundo).
function ColorSelect({ value, options, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();
  useEffect(() => {
    function onDocClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);
  const selected = options.find((o) => o.value === value);
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button type="button" onClick={() => setOpen((o) => !o)} style={{ ...inputStyle, display: "flex", alignItems: "center", gap: 8, cursor: "pointer", textAlign: "left", width: "100%", background: "#fff" }}>
        {selected?.hex && <span style={{ width: 16, height: 16, borderRadius: "50%", background: selected.hex, border: `1px solid ${TOKENS.line}`, flexShrink: 0 }} />}
        <span style={{ flex: 1, color: TOKENS.ink }}>{selected?.label || "Selecione"}</span>
        <ChevronDown size={14} color={TOKENS.graphite} />
      </button>
      {open && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: `1px solid ${TOKENS.line}`, borderRadius: 4, marginTop: 4, maxHeight: 220, overflowY: "auto", zIndex: 30, boxShadow: "0 6px 16px rgba(0,0,0,0.14)" }}>
          {options.map((o) => (
            <div key={o.value} onClick={() => { onChange(o.value); setOpen(false); }} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", cursor: "pointer", fontSize: 13, color: TOKENS.ink, background: o.value === value ? TOKENS.ivorySoft : "#fff" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = TOKENS.ivorySoft; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = o.value === value ? TOKENS.ivorySoft : "#fff"; }}>
              {o.hex ? <span style={{ width: 16, height: 16, borderRadius: "50%", background: o.hex, border: `1px solid ${TOKENS.line}`, flexShrink: 0 }} /> : <span style={{ width: 16, flexShrink: 0 }} />}
              <span>{o.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function novaEntradaCor() {
  return { key: uid("ce_"), variantId: "", novaCor: false, colorName: "", hex: "#7A2E38", catalogChoice: "__nova__", images: [], sizeQty: { P: 0, M: 0, G: 0, GG: 0 } };
}

function LancarCorteView({ products, categories, colors, garantirCorNoCatalogo, lancarCorte, persistProducts, onBack }) {
  const [novoModelo, setNovoModelo] = useState(false);
  const [productId, setProductId] = useState(products[0]?.id || "");
  const product = products.find((p) => p.id === productId);

  const [model, setModel] = useState("");
  const [sku, setSku] = useState("");
  const [category, setCategory] = useState(categories[0]);
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [costPrice, setCostPrice] = useState("");

  const [colorEntries, setColorEntries] = useState([novaEntradaCor()]);
  const [lastBatches, setLastBatches] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!novoModelo) {
      const firstVariant = product?.variants[0];
      setColorEntries([{ ...novaEntradaCor(), variantId: firstVariant?.id || "", novaCor: !product?.variants?.length, images: firstVariant?.images || [] }]);
    } else {
      setColorEntries([novaEntradaCor()]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, novoModelo]);

  function updateEntry(key, patch) {
    setColorEntries((entries) => entries.map((en) => en.key === key ? { ...en, ...patch } : en));
  }
  function addEntry() {
    setColorEntries((entries) => [...entries, novaEntradaCor()]);
  }
  function removeEntry(key) {
    setColorEntries((entries) => entries.length > 1 ? entries.filter((en) => en.key !== key) : entries);
  }
  async function addImagesToEntry(key, fileList, currentImages) {
    const files = Array.from(fileList).slice(0, 4 - currentImages.length);
    const dataUrls = await Promise.all(files.map((f) => fileToCompressedDataUrl(f)));
    updateEntry(key, { images: [...currentImages, ...dataUrls] });
  }

  const totalGeral = colorEntries.reduce((a, en) => a + Object.values(en.sizeQty).reduce((x, y) => x + (Number(y) || 0), 0), 0);

  async function submit(e) {
    e.preventDefault();
    const entriesValidas = colorEntries.filter((en) => Object.values(en.sizeQty).some((q) => (Number(q) || 0) > 0));
    if (!entriesValidas.length) { alert("Informe a quantidade cortada em pelo menos um tamanho, em pelo menos uma cor."); return; }
    if (novoModelo && !model.trim()) { alert("Preencha o nome do modelo."); return; }
    for (const en of entriesValidas) {
      if ((novoModelo || en.novaCor) && !en.colorName.trim()) { alert("Preencha o nome de todas as cores novas."); return; }
    }

    setSaving(true);
    try {
      // Cor digitada na hora (não escolhida do catálogo) já entra pro
      // catálogo reutilizável, pra não precisar ser criada de novo depois.
      for (const en of entriesValidas) {
        if ((novoModelo || en.novaCor) && en.catalogChoice === "__nova__") {
          await garantirCorNoCatalogo(en.colorName, en.hex);
        }
      }

      const zeroStock = { P: 0, M: 0, G: 0, GG: 0 };
      let targetProduct;
      const variantByKey = {};

      if (novoModelo) {
        const variants = entriesValidas.map((en) => {
          const v = { id: uid("v_"), color: en.colorName.trim(), hex: en.hex, images: en.images || [], stock: { ...zeroStock } };
          variantByKey[en.key] = v;
          return v;
        });
        targetProduct = { id: uid("p_"), model: model.trim(), sku: sku.trim(), category, description, price, costPrice, variants, nextItemSeq: 1 };
        await persistProdutosDireto(targetProduct, products, null);
      } else {
        const baseProduct = products.find((p) => p.id === productId);
        if (!baseProduct) { alert("Selecione um produto existente."); setSaving(false); return; }
        let variants = [...baseProduct.variants];
        entriesValidas.forEach((en) => {
          if (en.novaCor) {
            const v = { id: uid("v_"), color: en.colorName.trim(), hex: en.hex, images: en.images || [], stock: { ...zeroStock } };
            variants.push(v);
            variantByKey[en.key] = v;
          } else {
            let existing = variants.find((v) => v.id === en.variantId);
            if (en.images && JSON.stringify(en.images) !== JSON.stringify(existing.images || [])) {
              variants = variants.map((v) => v.id === existing.id ? { ...v, images: en.images } : v);
              existing = variants.find((v) => v.id === existing.id);
            }
            variantByKey[en.key] = existing;
          }
        });
        targetProduct = { ...baseProduct, variants };
        await persistProdutosDireto(targetProduct, products, productId);
      }

      const resultados = lancarCorte(entriesValidas.map((en) => ({ product: targetProduct, variant: variantByKey[en.key], sizeQtyMap: en.sizeQty })));
      setLastBatches(resultados);
      setColorEntries([novaEntradaCor()]);
      setModel(""); setSku(""); setDescription(""); setPrice(""); setCostPrice("");
    } finally { setSaving(false); }
  }

  // Grava o produto de uma vez só (todas as cores da leva juntas), em vez de
  // uma gravação por cor — evita a mesma corrida que já corrigimos antes
  // (duas gravações rápidas em sequência podiam se sobrescrever).
  async function persistProdutosDireto(targetProduct, currentProducts, replaceId) {
    const next = replaceId
      ? currentProducts.map((p) => p.id === replaceId ? targetProduct : p)
      : [targetProduct, ...currentProducts];
    await persistProducts(next);
  }

  if (lastBatches) return <CorteLancadoConfirmacao lastBatches={lastBatches} onNovoLancamento={() => setLastBatches(null)} onBack={onBack} />;

  return (
    <div style={{ maxWidth: 560 }}>
      <button onClick={onBack} style={btnGhostSmall}><ChevronLeft size={13} /> Voltar</button>
      <div style={{ fontFamily: "Georgia, serif", fontSize: 20, margin: "12px 0 4px" }}>Lançar corte</div>
      <div style={{ fontSize: 12, color: TOKENS.graphite, marginBottom: 18 }}>Registre o que foi cortado agora — pode lançar várias cores de uma vez. Fica pendente até a aprovação de um administrador.</div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button type="button" onClick={() => setNovoModelo(false)} style={{ flex: 1, padding: "8px 0", borderRadius: 3, border: `1px solid ${TOKENS.line}`, background: !novoModelo ? TOKENS.wine : "#fff", color: !novoModelo ? "#fff" : TOKENS.ink, fontSize: 12.5, cursor: "pointer" }}>Modelo existente</button>
        <button type="button" onClick={() => setNovoModelo(true)} style={{ flex: 1, padding: "8px 0", borderRadius: 3, border: `1px solid ${TOKENS.line}`, background: novoModelo ? TOKENS.wine : "#fff", color: novoModelo ? "#fff" : TOKENS.ink, fontSize: 12.5, cursor: "pointer" }}>Modelo novo</button>
      </div>

      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {!novoModelo ? (
          <div>
            <label style={labelStyle}>Produto</label>
            <select value={productId} onChange={(e) => setProductId(e.target.value)} style={inputStyle}>
              {products.map((p) => <option key={p.id} value={p.id}>{p.model}</option>)}
            </select>
          </div>
        ) : (
          <>
            <div>
              <label style={labelStyle}>Nome do modelo</label>
              <input value={model} onChange={(e) => setModel(e.target.value)} style={inputStyle} placeholder="Ex: Conjunto Aurora" />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>SKU</label>
                <input value={sku} onChange={(e) => setSku(e.target.value)} style={inputStyle} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Categoria</label>
                <select value={category} onChange={(e) => setCategory(e.target.value)} style={inputStyle}>
                  {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label style={labelStyle}>Descrição</label>
              <input value={description} onChange={(e) => setDescription(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Preço de venda</label>
              <input value={price} onChange={(e) => setPrice(e.target.value)} style={inputStyle} placeholder="0,00" />
            </div>
          </>
        )}

        {colorEntries.map((en, idx) => (
          <div key={en.key} style={{ border: `1px solid ${TOKENS.line}`, borderRadius: 8, padding: 14, background: TOKENS.ivorySoft }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: TOKENS.graphite, textTransform: "uppercase", letterSpacing: 0.4 }}>Cor {idx + 1}</div>
              {colorEntries.length > 1 && <button type="button" onClick={() => removeEntry(en.key)} style={{ background: "none", border: "none", color: "#A5453F", cursor: "pointer", fontSize: 11 }}><Trash2 size={13} /></button>}
            </div>

            {!novoModelo && (
              <div style={{ marginBottom: 10 }}>
                <label style={labelStyle}>Cor</label>
                <ColorSelect
                  value={en.novaCor ? "__nova__" : en.variantId}
                  options={[
                    ...(product?.variants.map((v) => ({ value: v.id, label: v.color || "(sem nome)", hex: v.hex })) || []),
                    { value: "__nova__", label: "+ Nova cor para este modelo", hex: null },
                  ]}
                  onChange={(val) => {
                    if (val === "__nova__") updateEntry(en.key, { novaCor: true, variantId: "", images: [] });
                    else updateEntry(en.key, { novaCor: false, variantId: val, images: product?.variants.find((v) => v.id === val)?.images || [] });
                  }}
                />
              </div>
            )}

            {(novoModelo || en.novaCor) && (
              <div style={{ marginBottom: 10 }}>
                <label style={labelStyle}>Cor</label>
                <ColorSelect
                  value={en.catalogChoice}
                  options={[
                    { value: "__nova__", label: "+ Nova cor", hex: null },
                    ...colors.map((c) => ({ value: c.name, label: c.name, hex: c.hex })),
                  ]}
                  onChange={(val) => {
                    if (val === "__nova__") updateEntry(en.key, { catalogChoice: "__nova__", colorName: "", hex: "#7A2E38" });
                    else { const found = colors.find((c) => c.name === val); updateEntry(en.key, { catalogChoice: val, colorName: found?.name || "", hex: found?.hex || "#7A2E38" }); }
                  }}
                />
                {en.catalogChoice === "__nova__" && (
                  <div style={{ display: "flex", gap: 10, alignItems: "flex-end", marginTop: 8 }}>
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle}>Nome da cor nova</label>
                      <input value={en.colorName} onChange={(e) => updateEntry(en.key, { colorName: e.target.value.toUpperCase() })} style={inputStyle} placeholder="Ex: VINHO" />
                    </div>
                    <input type="color" value={en.hex} onChange={(e) => updateEntry(en.key, { hex: e.target.value })} style={{ width: 40, height: 40, border: "none", padding: 0, background: "none", cursor: "pointer", borderRadius: "50%" }} />
                  </div>
                )}
              </div>
            )}

            <div style={{ marginBottom: 10 }}>
              <label style={labelStyle}>Fotos desta cor (até 4 · a 1ª é a principal)</label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {en.images.map((img, i) => (
                  <div key={i} style={{ position: "relative", width: 60, height: 76 }}>
                    <img src={img} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 3, border: i === 0 ? `2px solid ${TOKENS.wine}` : `1px solid ${TOKENS.line}` }} />
                    <button type="button" onClick={() => updateEntry(en.key, { images: en.images.filter((_, x) => x !== i) })} style={{ position: "absolute", top: -6, right: -6, background: TOKENS.wine, color: "#fff", border: "none", borderRadius: "50%", width: 16, height: 16, cursor: "pointer", fontSize: 10 }}>×</button>
                  </div>
                ))}
                {en.images.length < 4 && (
                  <label style={{ width: 60, height: 76, border: `1px dashed ${TOKENS.line}`, borderRadius: 3, background: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", color: TOKENS.graphite, gap: 3 }}>
                    <Upload size={13} /><span style={{ fontSize: 9 }}>Subir</span>
                    <input type="file" accept="image/*" multiple style={{ display: "none" }} onChange={(e) => e.target.files.length && addImagesToEntry(en.key, e.target.files, en.images)} />
                  </label>
                )}
              </div>
            </div>

            <label style={labelStyle}>Quantidade cortada por tamanho</label>
            <div style={{ display: "flex", gap: 8 }}>
              {SIZES.map((s) => (
                <div key={s} style={{ flex: 1 }}>
                  <div style={{ fontSize: 10.5, textAlign: "center", color: TOKENS.graphite, marginBottom: 3 }}>{s}</div>
                  <input type="number" min={0} value={en.sizeQty[s]} onChange={(e) => updateEntry(en.key, { sizeQty: { ...en.sizeQty, [s]: Math.max(0, Number(e.target.value) || 0) } })} style={{ ...inputStyle, textAlign: "center", background: "#fff" }} />
                </div>
              ))}
            </div>
          </div>
        ))}

        <button type="button" onClick={addEntry} style={{ ...btnGhostSmall, justifyContent: "center" }}><Plus size={14} /> Adicionar outra cor</button>

        <button type="submit" disabled={saving} style={{ ...btnPrimary, justifyContent: "center" }}>
          {saving ? "Salvando..." : <><Scissors size={14} /> Lançar corte ({totalGeral} peça{totalGeral === 1 ? "" : "s"} · {colorEntries.length} cor{colorEntries.length === 1 ? "" : "es"})</>}
        </button>
      </form>
    </div>
  );
}

function CorteLancadoConfirmacao({ lastBatches, onNovoLancamento, onBack }) {
  const product = lastBatches[0]?.product;
  function codeFor(variant, size) {
    const baseCode = shortSkuFor(product.sku, product.model).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10) || "ITEM";
    const colorCode = (variant.color || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3);
    return `${baseCode}-${colorCode}-${size}`;
  }
  const entries = lastBatches.flatMap(({ variant, batches }) =>
    batches.flatMap((b) => Array.from({ length: b.qty }, () => ({ model: product.model, color: variant.color, size: b.size, code: codeFor(variant, b.size) })))
  );
  const totalQty = entries.length;
  const totalCores = lastBatches.length;

  async function baixarPdf() {
    const blob = await buildItemLabelsPdfBlob(entries);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `corte-${product.model.replace(/\s+/g, "-").toLowerCase()}.pdf`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }
  function baixarEpl() {
    downloadEplFile(buildEplLabels(entries), `corte-${product.model.replace(/\s+/g, "-").toLowerCase()}.epl`);
  }

  return (
    <div style={{ maxWidth: 480 }}>
      <div style={{ background: "#EAF3DE", color: "#27500A", padding: "12px 14px", borderRadius: 4, fontSize: 13, marginBottom: 16 }}>
        Corte lançado! {product.model} — {totalCores} cor{totalCores === 1 ? "" : "es"}, {totalQty} peça(s) no total, aguardando aprovação.
      </div>
      <div style={{ fontSize: 12.5, color: TOKENS.graphite, marginBottom: 10 }}>Já pode imprimir as etiquetas (de todas as cores) para a produção colar nas peças enquanto costura:</div>
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <button onClick={baixarPdf} style={btnGhostSmall}><Printer size={13} /> Etiquetas (PDF)</button>
        <button onClick={baixarEpl} style={btnGhostSmall}>.epl (Zebra)</button>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onNovoLancamento} style={btnPrimary}><Scissors size={14} /> Lançar outro corte</button>
        <button onClick={onBack} style={btnGhostSmall}>Voltar ao menu</button>
      </div>
    </div>
  );
}


function CortesAdmin({ cutBatches, products, stockItems, aprovarCorte, rejeitarCorte, excluirCortes, canApprove, onBack }) {
  const sorted = cutBatches.slice().sort((a, b) => new Date(b.cutAt) - new Date(a.cutAt));
  const pendentes = sorted.filter((b) => b.status === "pendente");
  const outros = sorted.filter((b) => b.status !== "pendente");
  const [processingId, setProcessingId] = useState("");

  // Espera a gravação terminar de verdade antes de liberar o próximo clique
  // — clicar em aprovar vários tamanhos bem rápido, um atrás do outro, podia
  // fazer uma gravação "pisar" na outra e derrubar corte que ainda tava
  // pendente da tela (sem apagar do banco, só da memória local).
  async function handleAprovar(id) {
    setProcessingId(id);
    try { await aprovarCorte(id); } finally { setProcessingId(""); }
  }
  async function handleRejeitar(id) {
    setProcessingId(id);
    try { await rejeitarCorte(id); } finally { setProcessingId(""); }
  }

  // Busca as peças de verdade criadas na aprovação desse corte (cada uma com
  // seu código único e sequencial), em vez de gerar um código genérico por
  // cor/tamanho — assim a etiqueta impressa é a mesma referência usada na
  // Listagem de itens e reconhecida em "Receber estoque".
  function itemsFor(b) {
    return stockItems.filter((si) => si.cutBatchId === b.id);
  }
  function entryFor(si) {
    return { model: si.model, color: si.color, size: si.size, code: `${(si.sku || "").toUpperCase()}.${si.seq}` };
  }
  async function printBatchPdf(b) {
    const entries = itemsFor(b).map(entryFor);
    if (!entries.length) { alert("Não achei as peças numeradas desse corte."); return; }
    const blob = await buildItemLabelsPdfBlob(entries);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `producao-${b.model.replace(/\s+/g, "-").toLowerCase()}-${b.color.replace(/\s+/g, "-").toLowerCase()}-${b.size}.pdf`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }
  function printBatchEpl(b) {
    const entries = itemsFor(b).map(entryFor);
    if (!entries.length) { alert("Não achei as peças numeradas desse corte."); return; }
    downloadEplFile(buildEplLabels(entries), `producao-${b.model.replace(/\s+/g, "-").toLowerCase()}-${b.color.replace(/\s+/g, "-").toLowerCase()}-${b.size}.epl`);
  }

  const [selected, setSelected] = useState({});
  function toggleSelect(id) { setSelected((s) => ({ ...s, [id]: !s[id] })); }
  const selecionados = outros.filter((b) => b.status === "aprovado" && selected[b.id]);

  function entriesFor(batches) {
    return batches.flatMap((b) => itemsFor(b).map(entryFor));
  }
  async function printSelectedPdf() {
    const blob = await buildItemLabelsPdfBlob(entriesFor(selecionados));
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `etiquetas-selecionadas-${new Date().toISOString().slice(0, 10)}.pdf`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }
  function printSelectedEpl() {
    downloadEplFile(buildEplLabels(entriesFor(selecionados)), `etiquetas-selecionadas-${new Date().toISOString().slice(0, 10)}.epl`);
  }

  const [markedDelete, setMarkedDelete] = useState({});
  const [deleting, setDeleting] = useState(false);
  function toggleDelete(id) { setMarkedDelete((s) => ({ ...s, [id]: !s[id] })); setConfirmandoExclusao(false); }
  const marcadosParaExcluir = sorted.filter((b) => markedDelete[b.id]);

  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  async function handleExcluirSelecionados() {
    if (!marcadosParaExcluir.length) return;
    if (!confirmandoExclusao) { setConfirmandoExclusao(true); return; }
    setConfirmandoExclusao(false);
    setDeleting(true);
    try {
      const res = await excluirCortes(marcadosParaExcluir.map((b) => b.id));
      setMarkedDelete({});
      if (res.bloqueados?.length) alert("Alguns itens continuam no estoque normalmente, por já terem sido recebidos ou vendidos:\n\n" + res.bloqueados.join("\n"));
    } catch (e) {
      console.error("Erro ao excluir corte:", e);
      alert(`Não foi possível excluir agora.\nDetalhe do erro: ${e?.message || e}`);
    } finally { setDeleting(false); }
  }

  function Row({ b }) {
    const statusColor = b.status === "aprovado" ? { bg: "#EAF3DE", fg: "#27500A" } : b.status === "rejeitado" ? { bg: "#FCEBEB", fg: "#791F1F" } : b.status === "excluído" ? { bg: "#EFEFEF", fg: "#5A564C" } : { bg: "#FAEEDA", fg: "#633806" };
    return (
      <div style={{ background: "#fff", border: `1px solid ${TOKENS.line}`, borderRadius: 8, padding: "12px 14px", marginBottom: 8, opacity: b.status === "excluído" ? 0.6 : 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
          <div style={{ display: "flex", gap: 10 }}>
            {b.status !== "excluído" && <input type="checkbox" checked={!!markedDelete[b.id]} title="Marcar para exclusão" onChange={() => toggleDelete(b.id)} style={{ marginTop: 3 }} />}
            {b.status === "aprovado" && <input type="checkbox" checked={!!selected[b.id]} title="Marcar para imprimir" onChange={() => toggleSelect(b.id)} style={{ marginTop: 3 }} />}
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: TOKENS.ink }}>{b.model} · {b.color} · {b.size} — {b.qty} peça(s)</div>
              <div style={{ fontSize: 11.5, color: TOKENS.graphite, marginTop: 2 }}>Lançado por {b.cutBy} · {new Date(b.cutAt).toLocaleString("pt-BR")}</div>
              {b.status !== "pendente" && b.approvedBy && <div style={{ fontSize: 11.5, color: TOKENS.graphite }}>{b.status === "aprovado" ? "Aprovado" : "Recusado"} por {b.approvedBy} · {new Date(b.approvedAt).toLocaleString("pt-BR")}</div>}
            </div>
          </div>
          <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 3, background: statusColor.bg, color: statusColor.fg, whiteSpace: "nowrap" }}>{b.status}</span>
        </div>
        {b.status === "aprovado" && (
          <div style={{ display: "flex", gap: 8, marginTop: 10, marginLeft: 26 }}>
            <button onClick={() => printBatchPdf(b)} style={btnGhostSmall}><Printer size={13} /> Etiquetas (PDF)</button>
            <button onClick={() => printBatchEpl(b)} style={btnGhostSmall}>.epl (Zebra)</button>
          </div>
        )}
        {canApprove && b.status === "pendente" && (
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button onClick={() => handleAprovar(b.id)} disabled={!!processingId} style={{ ...btnPrimary, padding: "6px 14px", fontSize: 12, opacity: processingId ? 0.6 : 1 }}><Check size={13} /> {processingId === b.id ? "Aprovando..." : "Aprovar"}</button>
            <button onClick={() => handleRejeitar(b.id)} disabled={!!processingId} style={{ ...btnGhostSmall, color: "#A5453F", opacity: processingId ? 0.6 : 1 }}><X size={13} /> {processingId === b.id ? "Recusando..." : "Recusar"}</button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <button onClick={onBack} style={btnGhostSmall}><ChevronLeft size={13} /> Voltar</button>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "12px 0 18px", flexWrap: "wrap", gap: 8, minHeight: 36 }}>
        <div style={{ fontFamily: "Georgia, serif", fontSize: 20 }}>Cortes lançados</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", visibility: marcadosParaExcluir.length > 0 ? "visible" : "hidden" }}>
          <span style={{ fontSize: 11.5, color: "#A5453F", visibility: confirmandoExclusao ? "visible" : "hidden" }}>Clique de novo pra confirmar</span>
          <button onClick={handleExcluirSelecionados} disabled={deleting} style={{ ...btnGhostSmall, color: "#A5453F", borderColor: "#A5453F", background: confirmandoExclusao ? "#FCEBEB" : "#fff" }}>
            <Trash2 size={13} /> {deleting ? "Excluindo..." : confirmandoExclusao ? `Confirmar exclusão (${marcadosParaExcluir.length})` : `Excluir selecionado(s) (${marcadosParaExcluir.length})`}
          </button>
          <button onClick={() => setConfirmandoExclusao(false)} style={{ ...btnGhostSmall, visibility: confirmandoExclusao ? "visible" : "hidden" }}>Cancelar</button>
        </div>
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, color: TOKENS.graphite, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Pendentes ({pendentes.length})</div>
      {pendentes.length === 0 && <div style={{ fontSize: 12.5, color: TOKENS.graphite, marginBottom: 18 }}>Nenhum corte pendente.</div>}
      {pendentes.map((b) => <Row key={b.id} b={b} />)}
      {outros.length > 0 && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "18px 0 8px", flexWrap: "wrap", gap: 8, minHeight: 30 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: TOKENS.graphite, textTransform: "uppercase", letterSpacing: 0.5 }}>Histórico</div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", visibility: selecionados.length > 0 ? "visible" : "hidden" }}>
              <span style={{ fontSize: 11.5, color: TOKENS.graphite }}>{selecionados.length} selecionado(s)</span>
              <button onClick={printSelectedPdf} style={btnGhostSmall}><Printer size={13} /> Etiquetas selecionadas (PDF)</button>
              <button onClick={printSelectedEpl} style={btnGhostSmall}>.epl (Zebra)</button>
            </div>
          </div>
          {outros.map((b) => <Row key={b.id} b={b} />)}
        </>
      )}
    </div>
  );
}

function ProdutosAdmin({ products, setProducts, stockItems, setStockItems, categories, colors, garantirCorNoCatalogo }) {
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [filterCat, setFilterCat] = useState("Todas");
  const [selectedVariantByProduct, setSelectedVariantByProduct] = useState({});
  const [labelModal, setLabelModal] = useState(null); // { product, variant }
  const [labelQty, setLabelQty] = useState({ P: 0, M: 0, G: 0, GG: 0 });
  const [generatingLabels, setGeneratingLabels] = useState(false);

  function startNew() { setEditing({ id: uid("p_"), model: "", sku: "", category: categories[0], description: "", price: "", costPrice: "", variants: [], ncm: "", cfop: "", unit: "UN", cest: "" }); setShowForm(true); }
  function startEdit(p) { setEditing({ ...p, variants: p.variants.map((v) => ({ ...v, stock: { ...v.stock } })) }); setShowForm(true); }
  function remove(id) { if (confirm("Remover este produto do catálogo?")) setProducts(products.filter((p) => p.id !== id)); }
  // Ao salvar, compara o estoque anterior (editing) com o novo (p), por cor
  // e tamanho. Aumento gera peças individuais novas (numeradas .1 .2 .3...,
  // contínuo por SKU); redução remove peças disponíveis (ainda não vendidas)
  // dessa cor/tamanho — peças já vendidas em algum pedido nunca são tocadas.
  function save(p) {
    const exists = products.some((x) => x.id === p.id);
    const newStockItems = [];
    const removedIds = [];
    let seqCursor = p.nextItemSeq || 1;
    (p.variants || []).forEach((v) => {
      SIZES.forEach((s) => {
        // Compara com quantas peças JÁ estão rastreadas (não vendidas) para
        // esta cor/tamanho — não com o que estava na tela antes de abrir a
        // edição. Isso completa automaticamente estoque antigo que nunca
        // tinha gerado peça (lançado antes desta função existir).
        const tracked = (stockItems || []).filter((si) => si.productId === p.id && si.variantId === v.id && si.size === s && !si.orderId);
        const newQty = v.stock?.[s] || 0;
        const delta = newQty - tracked.length;
        if (delta > 0) {
          for (let i = 0; i < delta; i++) {
            newStockItems.push({
              id: uid("si_"), productId: p.id, variantId: v.id, model: p.model, sku: shortSkuFor(p.sku, p.model),
              color: v.color, hex: v.hex, size: s, seq: seqCursor, orderId: null, createdAt: new Date().toISOString(),
            });
            seqCursor++;
          }
        } else if (delta < 0) {
          removedIds.push(...tracked.slice(0, -delta).map((si) => si.id));
        }
      });
    });
    const nextP = { ...p, nextItemSeq: seqCursor };
    setProducts(exists ? products.map((x) => (x.id === p.id ? nextP : x)) : [nextP, ...products]);
    if (newStockItems.length || removedIds.length) {
      setStockItems([...(stockItems || []).filter((si) => !removedIds.includes(si.id)), ...newStockItems]);
    }
    setShowForm(false); setEditing(null);
  }

  function selectedVariantOf(p) {
    const vid = selectedVariantByProduct[p.id];
    return (p.variants || []).find((v) => v.id === vid) || p.variants?.[0] || null;
  }

  function openLabelModal(p) {
    const variant = selectedVariantOf(p);
    if (!variant) { alert("Cadastre pelo menos uma cor para este produto antes de gerar etiquetas."); return; }
    setLabelModal({ product: p, variant });
    setLabelQty({ P: variant.stock?.P || 0, M: variant.stock?.M || 0, G: variant.stock?.G || 0, GG: variant.stock?.GG || 0 });
  }

  // Usa as peças de verdade já rastreadas (mesmo código sequencial da
  // Listagem de itens) em vez de gerar um código em lote por cor/tamanho —
  // assim a etiqueta impressa aqui é idêntica à da Listagem de itens e à do
  // fluxo de corte, sem risco de colisão entre nomes de cor parecidos.
  function itemsForLabel(product, variant, qtyBySize) {
    const tracked = (stockItems || []).filter((si) => si.productId === product.id && si.variantId === variant.id && !si.orderId);
    const entries = [];
    SIZES.forEach((s) => {
      const n = Math.max(0, Math.floor(Number(qtyBySize?.[s]) || 0));
      const pool = tracked.filter((si) => si.size === s).sort((a, b) => a.seq - b.seq).slice(0, n);
      pool.forEach((si) => entries.push({ model: si.model, color: si.color, size: si.size, code: `${(si.sku || "").toUpperCase()}.${si.seq}` }));
    });
    return entries;
  }

  async function confirmGenerateLabels() {
    setGeneratingLabels(true);
    try {
      const { product, variant } = labelModal;
      const entries = itemsForLabel(product, variant, labelQty);
      if (!entries.length) { alert("Coloque uma quantidade maior que 0 em pelo menos um tamanho para gerar as etiquetas."); return; }
      const blob = await buildItemLabelsPdfBlob(entries);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `etiquetas-${(product.model || "produto").replace(/\s+/g, "-").toLowerCase()}-${(variant.color || "cor").replace(/\s+/g, "-").toLowerCase()}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      setLabelModal(null);
    } catch (e) {
      alert(`Não foi possível gerar as etiquetas agora.\nDetalhe do erro: ${e?.message || e}`);
    } finally { setGeneratingLabels(false); }
  }
  // Gera o arquivo .csv (fonte de dados para o ZebraDesigner) com as mesmas
  // etiquetas — caminho mais confiável que o .epl, já que quem imprime de
  // verdade é o próprio ZebraDesigner, que já sabe falar com a impressora.
  function confirmGenerateCsv() {
    const { product, variant } = labelModal;
    const entries = itemsForLabel(product, variant, labelQty);
    if (!entries.length) { alert("Coloque uma quantidade maior que 0 em pelo menos um tamanho para gerar as etiquetas."); return; }
    downloadCsvFile(buildLabelsCsv(entries), `etiquetas-${(product.model || "produto").replace(/\s+/g, "-").toLowerCase()}-${(variant.color || "cor").replace(/\s+/g, "-").toLowerCase()}.csv`);
    setLabelModal(null);
  }
  // Gera o arquivo .epl (comando direto para a Zebra GC420t) com as mesmas
  // etiquetas, para quem imprime direto na impressora em vez de via PDF.
  function confirmGenerateEpl() {
    const { product, variant } = labelModal;
    const entries = itemsForLabel(product, variant, labelQty);
    if (!entries.length) { alert("Coloque uma quantidade maior que 0 em pelo menos um tamanho para gerar as etiquetas."); return; }
    downloadEplFile(buildEplLabels(entries), `etiquetas-${(product.model || "produto").replace(/\s+/g, "-").toLowerCase()}-${(variant.color || "cor").replace(/\s+/g, "-").toLowerCase()}.epl`);
    setLabelModal(null);
  }

  const list = filterCat === "Todas" ? products : products.filter((p) => p.category === filterCat);

  async function exportarEstoqueExcel() {
    const XLSX = await loadXLSX();
    const rows = [];
    list.forEach((p) => {
      (p.variants || []).forEach((v) => {
        SIZES.forEach((s) => {
          const pronta = v.stock?.[s] || 0;
          const producao = v.stockProducao?.[s] || 0;
          if (!pronta && !producao) return;
          rows.push({
            "Categoria": p.category || "", "Modelo": p.model, "SKU": p.sku || "", "Cor": v.color || "(sem nome)",
            "Tamanho": s, "Pronta entrega": pronta, "Em produção": producao,
            "Previsão produção": producao && v.producaoDate?.[s] ? new Date(v.producaoDate[s]).toLocaleDateString("pt-BR") : "",
            "Preço": p.price || "", "Preço de custo": p.costPrice || "",
          });
        });
      });
    });
    downloadXLSX(XLSX, rows, "Estoque", `estoque-mallo-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  const [gerandoCatalogo, setGerandoCatalogo] = useState(false);
  async function baixarCatalogoPdf() {
    setGerandoCatalogo(true);
    try {
      const blob = await buildCatalogPdfBlob(list);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `catalogo-mallo-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(`Não foi possível gerar o catálogo agora.\nDetalhe do erro: ${e?.message || e}`);
    } finally { setGerandoCatalogo(false); }
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <div style={{ fontSize: 13, color: TOKENS.graphite }}>{list.length} modelo(s)</div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <select value={filterCat} onChange={(e) => setFilterCat(e.target.value)} style={{ ...inputStyle, width: "auto", padding: "8px 10px" }}>
            <option>Todas</option>
            {categories.map((c) => <option key={c}>{c}</option>)}
          </select>
          <button onClick={baixarCatalogoPdf} disabled={gerandoCatalogo} style={btnGhostSmall}><Printer size={13} /> {gerandoCatalogo ? "Gerando..." : "Catálogo (PDF)"}</button>
          <button onClick={exportarEstoqueExcel} style={btnGhostSmall}><Download size={13} /> Exportar Excel</button>
          <button onClick={startNew} style={btnPrimary}><Plus size={15} /> Novo modelo</button>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px,1fr))", gap: 16 }}>
        {list.map((p) => {
          const activeVariant = selectedVariantOf(p);
          return (
          <div key={p.id} style={{ background: "#fff", border: `1px solid ${TOKENS.line}`, borderRadius: 4, overflow: "hidden" }}>
            <div style={{ aspectRatio: "3/4", background: TOKENS.ivorySoft, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {activeVariant?.images?.[0] ? <img src={activeVariant.images[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <ImageIcon size={28} color={TOKENS.line} />}
            </div>
            <div style={{ padding: 12 }}>
              <div style={{ fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: TOKENS.wine, marginBottom: 3 }}>{p.category}</div>
              <div style={{ fontWeight: 600, fontSize: 14, color: TOKENS.ink }}>{p.model || "(sem nome)"}</div>
              <div style={{ fontSize: 11.5, color: TOKENS.graphite, margin: "4px 0 6px" }}>R$ {p.price || "0,00"}</div>
              <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
                {(p.variants || []).map((v) => (
                  <button key={v.id} title={v.color} onClick={() => setSelectedVariantByProduct((s) => ({ ...s, [p.id]: v.id }))} style={{
                    width: 20, height: 20, minWidth: 20, borderRadius: "50%", background: v.hex, cursor: "pointer", padding: 0, flexShrink: 0,
                    border: activeVariant?.id === v.id ? `2px solid ${TOKENS.wine}` : `1px solid ${TOKENS.line}`,
                    boxShadow: activeVariant?.id === v.id ? "0 0 0 2px #fff inset" : "none",
                  }} />
                ))}
              </div>
              <div style={{ fontSize: 10.5, color: TOKENS.graphite, marginBottom: 6, lineHeight: 1.6 }}>
                {(p.variants || []).map((v) => {
                  const temProducao = SIZES.some((s) => (v.stockProducao?.[s] || 0) > 0);
                  return (
                    <div key={v.id}>
                      <b style={{ color: TOKENS.ink }}>{v.color || "(sem nome)"}:</b> {SIZES.map((s) => `${s} ${v.stock?.[s] || 0}`).join(" · ")}
                      {temProducao && <div style={{ color: "#BA7517" }}>Em produção: {SIZES.map((s) => `${s} ${v.stockProducao?.[s] || 0}`).join(" · ")}</div>}
                    </div>
                  );
                })}
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: TOKENS.ink, borderTop: `1px solid ${TOKENS.line}`, paddingTop: 6, marginBottom: 10 }}>
                Total: {(p.variants || []).reduce((a, v) => a + SIZES.reduce((b, s) => b + (v.stock?.[s] || 0), 0), 0)} peça(s)
                {(p.variants || []).reduce((a, v) => a + SIZES.reduce((b, s) => b + (v.stockProducao?.[s] || 0), 0), 0) > 0 &&
                  <span style={{ color: "#BA7517", fontWeight: 400 }}> · {(p.variants || []).reduce((a, v) => a + SIZES.reduce((b, s) => b + (v.stockProducao?.[s] || 0), 0), 0)} em produção</span>}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button onClick={() => startEdit(p)} style={btnGhostSmall}><Pencil size={13} /> Editar</button>
                <button onClick={() => remove(p.id)} style={{ ...btnGhostSmall, color: "#A5453F" }}><Trash2 size={13} /> Excluir</button>
                <button onClick={() => openLabelModal(p)} style={btnGhostSmall}><Printer size={13} /> Etiquetas {activeVariant ? `(${activeVariant.color})` : ""}</button>
              </div>
            </div>
          </div>
          );
        })}
      </div>
      {showForm && <ProductForm initial={editing} categories={categories} colors={colors} garantirCorNoCatalogo={garantirCorNoCatalogo} onCancel={() => { setShowForm(false); setEditing(null); }} onSave={save} />}

      {labelModal && (
        <div style={overlayStyle}>
          <div style={{ ...modalStyle, maxWidth: 420 }}>
            <div style={modalHeaderStyle}>
              <div style={{ fontFamily: "Georgia, serif", fontSize: 16 }}>Gerar etiquetas</div>
              <button onClick={() => setLabelModal(null)} style={iconBtnStyle}><X size={18} /></button>
            </div>
            <div style={{ padding: 20 }}>
              <div style={{ fontSize: 12.5, color: TOKENS.graphite, marginBottom: 14, lineHeight: 1.5 }}>
                <b style={{ color: TOKENS.ink }}>{labelModal.product.model}</b> · {labelModal.variant.color}<br />
                Confira a quantidade de etiquetas por tamanho — já vem preenchido com o estoque atual, mas você pode ajustar antes de gerar.
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {SIZES.map((s) => (
                  <div key={s} style={{ flex: 1 }}>
                    <div style={{ fontSize: 10.5, textAlign: "center", color: TOKENS.graphite, marginBottom: 3 }}>{s}</div>
                    <input type="number" min={0} value={labelQty[s]} onChange={(e) => setLabelQty((q) => ({ ...q, [s]: Math.max(0, Number(e.target.value) || 0) }))} style={{ ...inputStyle, textAlign: "center", padding: "7px 4px" }} />
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 10.5, color: TOKENS.graphite, marginTop: 10 }}>Total de etiquetas: {SIZES.reduce((a, s) => a + (Number(labelQty[s]) || 0), 0)}</div>
            </div>
            <div style={modalFooterStyle}>
              <button onClick={() => setLabelModal(null)} style={btnGhostSmall}>Cancelar</button>
              <button onClick={confirmGenerateCsv} style={btnGhostSmall}>.csv (ZebraDesigner)</button>
              <button onClick={confirmGenerateEpl} style={btnGhostSmall}>.epl (Zebra)</button>
              <button onClick={confirmGenerateLabels} disabled={generatingLabels} style={btnPrimary}><Printer size={15} /> {generatingLabels ? "Gerando..." : "Gerar etiquetas (PDF)"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ItemListAdmin({ stockItems, setStockItems, orders, products, setProducts }) {
  const [selected, setSelected] = useState({});
  const [printingBulk, setPrintingBulk] = useState(false);
  const [printingId, setPrintingId] = useState("");

  const list = [...(stockItems || [])].sort((a, b) => (a.model || "").localeCompare(b.model || "") || (a.color || "").localeCompare(b.color || "") || (a.seq || 0) - (b.seq || 0));
  const selectableIds = list.filter((si) => !si.orderId).map((si) => si.id);
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selected[id]);

  function toggleAll() {
    if (allSelected) { setSelected({}); return; }
    const next = {};
    selectableIds.forEach((id) => { next[id] = true; });
    setSelected(next);
  }
  function toggleOne(id) { setSelected((s) => ({ ...s, [id]: !s[id] })); }

  function orderOf(orderId) { return orders.find((o) => o.id === orderId); }

  function downloadPdf(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  async function printOne(si) {
    setPrintingId(si.id);
    try {
      const blob = await buildItemLabelsPdfBlob([{ model: si.model, color: si.color, size: si.size, code: `${si.sku}.${si.seq}` }]);
      downloadPdf(blob, `etiqueta-${si.sku}.${si.seq}.pdf`);
    } catch (e) {
      alert(`Não foi possível gerar a etiqueta agora.\nDetalhe do erro: ${e?.message || e}`);
    } finally { setPrintingId(""); }
  }
  function printOneEpl(si) {
    downloadEplFile(buildEplLabels([{ model: si.model, color: si.color, size: si.size, code: `${si.sku}.${si.seq}` }]), `etiqueta-${si.sku}.${si.seq}.epl`);
  }

  async function printSelected() {
    const items = list.filter((si) => selected[si.id]);
    if (!items.length) { alert("Selecione ao menos um item para imprimir."); return; }
    setPrintingBulk(true);
    try {
      const blob = await buildItemLabelsPdfBlob(items.map((si) => ({ model: si.model, color: si.color, size: si.size, code: `${si.sku}.${si.seq}` })));
      downloadPdf(blob, `etiquetas-selecionadas.pdf`);
    } catch (e) {
      alert(`Não foi possível gerar as etiquetas agora.\nDetalhe do erro: ${e?.message || e}`);
    } finally { setPrintingBulk(false); }
  }
  function printSelectedEpl() {
    const items = list.filter((si) => selected[si.id]);
    if (!items.length) { alert("Selecione ao menos um item para imprimir."); return; }
    downloadEplFile(buildEplLabels(items.map((si) => ({ model: si.model, color: si.color, size: si.size, code: `${si.sku}.${si.seq}` }))), `etiquetas-selecionadas.epl`);
  }

  // Ao excluir uma peça (individual ou em lote) da listagem, abate também
  // a mesma quantidade do estoque do produto correspondente, já que a peça
  // deixou de existir fisicamente. entries: [{productId, variantId, size, qty}]
  function decrementStockFor(entries) {
    let nextProducts = products;
    entries.forEach(({ productId, variantId, size, qty }) => {
      nextProducts = nextProducts.map((p) => p.id !== productId ? p : {
        ...p,
        variants: p.variants.map((v) => v.id !== variantId ? v : { ...v, stock: { ...v.stock, [size]: Math.max(0, (v.stock?.[size] || 0) - qty) } }),
      });
    });
    setProducts(nextProducts);
  }

  function deleteOne(si) {
    if (si.orderId) return;
    if (!confirm(`Excluir a peça ${si.sku}.${si.seq}? Isso também abate 1 unidade do estoque de ${si.color} · ${si.size}.`)) return;
    decrementStockFor([{ productId: si.productId, variantId: si.variantId, size: si.size, qty: 1 }]);
    setStockItems(stockItems.filter((x) => x.id !== si.id));
  }

  function deleteSelected() {
    const ids = Object.keys(selected).filter((id) => selected[id]);
    if (!ids.length) { alert("Selecione ao menos um item para excluir."); return; }
    if (!confirm(`Excluir ${ids.length} peça(s) selecionada(s)? Isso também abate do estoque de cada uma.`)) return;
    const toDelete = list.filter((si) => ids.includes(si.id));
    const grouped = {};
    toDelete.forEach((si) => {
      const key = `${si.productId}__${si.variantId}__${si.size}`;
      if (!grouped[key]) grouped[key] = { productId: si.productId, variantId: si.variantId, size: si.size, qty: 0 };
      grouped[key].qty++;
    });
    decrementStockFor(Object.values(grouped));
    setStockItems(stockItems.filter((si) => !ids.includes(si.id)));
    setSelected({});
  }

  return (
    <div>
      <div style={{ fontFamily: "Georgia, serif", fontSize: 22, color: TOKENS.ink, marginBottom: 6 }}>Listagem de itens</div>
      <div style={{ fontSize: 12, color: TOKENS.graphite, marginBottom: 16 }}>Cada peça lançada no estoque vira uma linha aqui, numerada por SKU (.1 .2 .3...). Peças já vendidas mostram em qual pedido entraram e não podem ser excluídas ou selecionadas.</div>
      <div style={{ background: "#fff", border: `1px solid ${TOKENS.line}`, borderRadius: 4, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", borderBottom: `1px solid ${TOKENS.ivorySoft}`, flexWrap: "wrap", gap: 8 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: TOKENS.graphite }}>
            <input type="checkbox" checked={allSelected} onChange={toggleAll} disabled={!selectableIds.length} /> Selecionar todos
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={printSelected} disabled={printingBulk} style={btnGhostSmall}><Printer size={13} /> {printingBulk ? "Gerando..." : "Imprimir selecionados (PDF)"}</button>
            <button onClick={printSelectedEpl} style={btnGhostSmall}>.epl (Zebra)</button>
            <button onClick={deleteSelected} style={{ ...btnGhostSmall, color: "#A5453F" }}><Trash2 size={13} /> Excluir selecionados</button>
          </div>
        </div>
        {list.length === 0 && <div style={{ padding: 20, fontSize: 13, color: TOKENS.graphite }}>Nenhum item lançado ainda. Cadastre estoque em Produtos & Estoque.</div>}
        {list.map((si) => {
          const sold = !!si.orderId;
          const order = sold ? orderOf(si.orderId) : null;
          return (
            <div key={si.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderBottom: `1px solid ${TOKENS.ivorySoft}`, background: sold ? TOKENS.ivorySoft : "#fff" }}>
              <input type="checkbox" checked={!!selected[si.id]} disabled={sold} onChange={() => toggleOne(si.id)} />
              <span style={{ width: 14, height: 14, borderRadius: "50%", background: si.hex, border: `1px solid ${TOKENS.line}`, flexShrink: 0 }} />
              <span style={{ fontSize: 13, flex: 1, color: TOKENS.ink }}>{si.model} <span style={{ color: TOKENS.graphite }}>· {si.color}</span></span>
              <span style={{ fontSize: 12, color: TOKENS.graphite, fontFamily: "monospace" }}>{si.sku}.{si.seq}</span>
              <span style={{ fontSize: 11, color: TOKENS.graphite, width: 26 }}>{si.size}</span>
              {sold ? (
                <span style={{ fontSize: 10.5, color: TOKENS.graphite }}>Vendido · pedido de {order?.clientName || "?"}{order ? ` (${order.status})` : ""}</span>
              ) : (
                <>
                  {si.confirmed === false && <span style={{ fontSize: 10, fontWeight: 600, color: "#633806", background: "#FAEEDA", padding: "2px 8px", borderRadius: 3, whiteSpace: "nowrap" }}>Em produção</span>}
                  <button onClick={() => printOne(si)} disabled={printingId === si.id} title="Baixar PDF" style={iconBtnStyle}><Printer size={15} /></button>
                  <button onClick={() => printOneEpl(si)} title="Baixar .epl (Zebra)" style={{ ...iconBtnStyle, fontSize: 10, fontWeight: 700 }}>EPL</button>
                  <button onClick={() => deleteOne(si)} style={{ ...iconBtnStyle, color: "#A5453F" }}><Trash2 size={15} /></button>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ProductForm({ initial, categories, colors, garantirCorNoCatalogo, onCancel, onSave }) {
  const [p, setP] = useState(initial);

  function addVariant() { setP((s) => ({ ...s, variants: [...s.variants, { id: uid("v_"), color: "", hex: "#8C3A3A", images: [], stock: { P: 0, M: 0, G: 0, GG: 0 } }] })); }
  function removeVariant(id) { setP((s) => ({ ...s, variants: s.variants.filter((v) => v.id !== id) })); }
  function updateVariant(id, patch) { setP((s) => ({ ...s, variants: s.variants.map((v) => v.id === id ? { ...v, ...patch } : v) })); }
  function setVariantStock(id, size, val) { setP((s) => ({ ...s, variants: s.variants.map((v) => v.id === id ? { ...v, stock: { ...v.stock, [size]: Math.max(0, Number(val) || 0) } } : v) })); }
  // Kits são vendidos fechados, sempre na proporção 1 P / 2 M / 2 G / 1 GG.
  // Em vez de digitar os 4 tamanhos, digita quantos kits e o estoque por
  // tamanho é calculado sozinho.
  function setVariantKitQty(id, val) {
    const n = Math.max(0, Number(val) || 0);
    setP((s) => ({ ...s, variants: s.variants.map((v) => v.id === id ? { ...v, stock: { P: n * 1, M: n * 2, G: n * 2, GG: n * 1 } } : v) }));
  }
  async function addVariantImages(id, fileList, current) {
    const files = Array.from(fileList).slice(0, 4 - current.length);
    const dataUrls = await Promise.all(files.map((f) => fileToCompressedDataUrl(f)));
    updateVariant(id, { images: [...current, ...dataUrls] });
  }
  function removeVariantImage(id, idx, current) { updateVariant(id, { images: current.filter((_, i) => i !== idx) }); }
  async function handleSave() {
    for (const v of p.variants) {
      if (v.color?.trim()) await garantirCorNoCatalogo(v.color, v.hex);
    }
    onSave(p);
  }

  return (
    <div style={overlayStyle}>
      <div style={{ ...modalStyle, maxWidth: 700 }}>
        <div style={modalHeaderStyle}>
          <div style={{ fontFamily: "Georgia, serif", fontSize: 18 }}>{initial.model ? "Editar modelo" : "Novo modelo"}</div>
          <button onClick={onCancel} style={iconBtnStyle}><X size={18} /></button>
        </div>
        <div style={{ padding: 20, maxHeight: "72vh", overflowY: "auto" }}>
          <FieldLabel>Categoria</FieldLabel>
          <select value={p.category} onChange={(e) => setP({ ...p, category: e.target.value })} style={inputStyle}>
            {categories.map((c) => <option key={c}>{c}</option>)}
          </select>

          <FieldLabel>Nome do modelo</FieldLabel>
          <input value={p.model} onChange={(e) => setP({ ...p, model: e.target.value })} style={inputStyle} placeholder="Ex: Vestido Aurora" />

          <FieldLabel>SKU</FieldLabel>
          <input value={p.sku || ""} onChange={(e) => setP({ ...p, sku: e.target.value })} style={inputStyle} placeholder="Ex: MAL-VEST-AUR-01" />

          <FieldLabel>Descrição</FieldLabel>
          <textarea value={p.description} onChange={(e) => setP({ ...p, description: e.target.value })} style={{ ...inputStyle, minHeight: 58, resize: "vertical" }} placeholder="Tecido, caimento, detalhes..." />

          <FieldLabel>Preço (atacado)</FieldLabel>
          <input value={p.price} onChange={(e) => setP({ ...p, price: e.target.value })} style={inputStyle} placeholder="0,00" />
          <div style={{ fontSize: 10.5, color: TOKENS.graphite, marginTop: 4 }}>O preço de custo é definido separadamente no Painel Central, por quem tem acesso de Admin Central.</div>

          <div style={{ margin: "18px 0 8px" }}>
            <FieldLabel>Dados fiscais (para nota fiscal)</FieldLabel>
            <div style={{ fontSize: 10.5, color: TOKENS.graphite, marginBottom: 8 }}>Opcional por enquanto — usado quando a emissão de nota fiscal for ativada.</div>
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, color: TOKENS.graphite, marginBottom: 3 }}>NCM</div>
                <input value={p.ncm || ""} onChange={(e) => setP({ ...p, ncm: e.target.value })} style={inputStyle} placeholder="Ex: 6109.10.00" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, color: TOKENS.graphite, marginBottom: 3 }}>CFOP</div>
                <input value={p.cfop || ""} onChange={(e) => setP({ ...p, cfop: e.target.value })} style={inputStyle} placeholder="Ex: 5101" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, color: TOKENS.graphite, marginBottom: 3 }}>Unidade</div>
                <input value={p.unit || "UN"} onChange={(e) => setP({ ...p, unit: e.target.value })} style={inputStyle} placeholder="UN" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, color: TOKENS.graphite, marginBottom: 3 }}>CEST</div>
                <input value={p.cest || ""} onChange={(e) => setP({ ...p, cest: e.target.value })} style={inputStyle} placeholder="Opcional" />
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "18px 0 8px" }}>
            <FieldLabel>Cores e fotos por cor</FieldLabel>
            <button onClick={addVariant} style={btnGhostSmall}><Plus size={13} /> Adicionar cor</button>
          </div>

          {p.variants.length === 0 && <div style={{ fontSize: 12, color: TOKENS.graphite, padding: 12, background: TOKENS.ivorySoft, borderRadius: 3 }}>Nenhuma cor adicionada. Cadastre pelo menos uma cor com suas fotos e estoque.</div>}

          {p.variants.map((v) => (
            <VariantEditor key={v.id} v={v} colors={colors} category={p.category}
              onChange={(patch) => updateVariant(v.id, patch)}
              onRemove={() => removeVariant(v.id)}
              onAddImages={(files) => addVariantImages(v.id, files, v.images)}
              onRemoveImage={(idx) => removeVariantImage(v.id, idx, v.images)}
              onSetStock={(size, val) => setVariantStock(v.id, size, val)}
              onSetKitQty={(val) => setVariantKitQty(v.id, val)}
            />
          ))}
        </div>
        <div style={modalFooterStyle}>
          <button onClick={onCancel} style={btnGhostSmall}>Cancelar</button>
          <button onClick={handleSave} style={btnPrimary} disabled={!p.model.trim()}><Check size={15} /> Salvar modelo</button>
        </div>
      </div>
    </div>
  );
}

function VariantEditor({ v, colors, category, onChange, onRemove, onAddImages, onRemoveImage, onSetStock, onSetKitQty }) {
  const fileRef = useRef();
  const isKit = category === "KIT'S";
  // Kit fechado: 1 P / 2 M / 2 G / 1 GG por unidade. Deduz quantos kits já
  // tem a partir do estoque salvo (usa P, que é sempre 1x a quantidade).
  const kitQty = v.stock.P || 0;

  return (
    <div style={{ border: `1px solid ${TOKENS.line}`, borderRadius: 4, padding: 14, marginBottom: 12, background: TOKENS.ivorySoft }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
          <input type="color" value={v.hex} onChange={(e) => onChange({ hex: e.target.value })} style={{ width: 34, height: 34, border: "none", padding: 0, background: "none", cursor: "pointer", borderRadius: "50%" }} />
          <input value={v.color} onChange={(e) => onChange({ color: e.target.value.toUpperCase() })} placeholder="Nome da cor (ex: VERMELHO)" style={{ ...inputStyle, maxWidth: 220 }} />
          {colors?.length > 0 && (
            <div style={{ width: 200 }}>
              <ColorSelect value="" options={[{ value: "", label: "Usar cor já cadastrada...", hex: null }, ...colors.map((c) => ({ value: c.name, label: c.name, hex: c.hex }))]}
                onChange={(val) => { const found = colors.find((c) => c.name === val); if (found) onChange({ color: found.name, hex: found.hex }); }} />
            </div>
          )}
        </div>
        <button onClick={onRemove} style={{ ...iconBtnStyle, color: "#A5453F" }}><Trash2 size={15} /></button>
      </div>

      <div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: 1, color: TOKENS.graphite, marginBottom: 6 }}>Fotos desta cor (até 4 · a 1ª é a foto principal)</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        {v.images.map((img, i) => (
          <div key={i} style={{ position: "relative", width: 66, height: 84 }}>
            <img src={img} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 3, border: i === 0 ? `2px solid ${TOKENS.wine}` : `1px solid ${TOKENS.line}` }} />
            {i === 0 && <span style={{ position: "absolute", bottom: 2, left: 2, background: TOKENS.wine, color: "#fff", fontSize: 8, padding: "1px 4px", borderRadius: 2 }}>Principal</span>}
            <button onClick={() => onRemoveImage(i)} style={{ position: "absolute", top: -6, right: -6, background: TOKENS.wine, color: "#fff", border: "none", borderRadius: "50%", width: 18, height: 18, cursor: "pointer", fontSize: 11 }}>×</button>
          </div>
        ))}
        {v.images.length < 4 && (
        <button onClick={() => fileRef.current.click()} style={{ width: 66, height: 84, border: `1px dashed ${TOKENS.line}`, borderRadius: 3, background: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", color: TOKENS.graphite, gap: 4 }}>
            <Upload size={14} /><span style={{ fontSize: 9.5 }}>Subir</span>
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={(e) => e.target.files.length && onAddImages(e.target.files)} />
      </div>

      {isKit ? (
        <>
          <div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: 1, color: TOKENS.graphite, marginBottom: 6 }}>Quantidade de kits (1 P · 2 M · 2 G · 1 GG cada)</div>
          <input type="number" min={0} value={kitQty} onChange={(e) => onSetKitQty(e.target.value)} style={{ ...inputStyle, maxWidth: 140, padding: "7px 10px", background: "#fff" }} />
          <div style={{ fontSize: 11, color: TOKENS.graphite, marginTop: 6 }}>
            Estoque calculado: P {v.stock.P} · M {v.stock.M} · G {v.stock.G} · GG {v.stock.GG}
          </div>
        </>
      ) : (
        <>
          <div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: 1, color: TOKENS.graphite, marginBottom: 6 }}>Estoque por tamanho</div>
          <div style={{ display: "flex", gap: 8 }}>
            {SIZES.map((s) => (
              <div key={s} style={{ flex: 1 }}>
                <div style={{ fontSize: 10.5, textAlign: "center", color: TOKENS.graphite, marginBottom: 3 }}>{s}</div>
                <input type="number" min={0} value={v.stock[s]} onChange={(e) => onSetStock(s, e.target.value)} style={{ ...inputStyle, textAlign: "center", padding: "7px 4px", background: "#fff" }} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ClientesAdmin({ users, setUsers, role, title }) {
  const [name, setName] = useState("");
  const [access, setAccess] = useState("atacado");
  const [permissions, setPermissions] = useState(ALL_PERMISSION_IDS);
  const [lastGenerated, setLastGenerated] = useState(null);
  const [copiedKey, setCopiedKey] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [revokingId, setRevokingId] = useState("");
  const [editingPerms, setEditingPerms] = useState(null); // username sendo editado, ou null

  function togglePerm(id) {
    setPermissions((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);
  }

  // Cria o login de verdade (Supabase Auth) através de uma função no
  // servidor — o app nunca manuseia a criação de contas diretamente, já que
  // isso exige a chave de administrador do Supabase, que nunca fica exposta
  // no navegador.
  async function generate() {
    if (!name.trim()) { setCreateError("Preencha o nome antes de gerar o login."); return; }
    if (role === "admin" && permissions.length === 0) { setCreateError("Selecione ao menos uma área de acesso para este funcionário."); return; }
    setCreateError("");
    const base = name.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, ".").replace(/(^\.|\.$)/g, "");
    let username = base || uid(role === "representante" ? "rep_" : role === "admin" ? "func_" : "cli_");
    let n = 1;
    while (users[username]) { username = `${base}${n}`; n++; }
    const finalAccess = role === "representante" ? "atacado" : access;
    const finalPerms = role === "admin" ? permissions : undefined;
    setCreating(true);
    const { data, error } = await withRetry(() => supabase.functions.invoke("staff-accounts", {
      body: { action: "create", username, name: name.trim(), role, access: finalAccess, permissions: finalPerms },
    }));
    setCreating(false);
    if (error || data?.error) { setCreateError(data?.error || "Não foi possível criar o login agora. Tente novamente."); return; }
    setUsers({ ...users, [data.username]: { name: data.name, role, access: data.access, permissions: data.permissions, authEmail: `${data.username}@mallo.internal` } });
    setLastGenerated({ username: data.username, password: data.password, name: data.name, access: data.access });
    setName("");
    setPermissions(ALL_PERMISSION_IDS);
  }
  async function revoke(username) {
    if (!confirm(`Revogar acesso de "${username}"?`)) return;
    setRevokingId(username);
    const { data, error } = await withRetry(() => supabase.functions.invoke("staff-accounts", { body: { action: "revoke", username } }));
    setRevokingId("");
    if (error || data?.error) { alert(data?.error || "Não foi possível revogar agora. Tente novamente."); return; }
    const n = { ...users }; delete n[username]; setUsers(n);
  }
  async function resetPassword(username) {
    if (!confirm(`Gerar uma nova senha para "${username}"? A senha antiga deixa de funcionar.`)) return;
    setRevokingId(username);
    const { data, error } = await withRetry(() => supabase.functions.invoke("staff-accounts", { body: { action: "reset", username } }));
    setRevokingId("");
    if (error || data?.error) { alert(data?.error || "Não foi possível redefinir a senha agora. Tente novamente."); return; }
    setLastGenerated({ username: data.username, password: data.password, name: data.name, access: data.access });
  }
  async function savePermissions(username, newPerms) {
    const { data, error } = await withRetry(() => supabase.functions.invoke("staff-accounts", { body: { action: "update_permissions", username, permissions: newPerms } }));
    if (error || data?.error) { alert(data?.error || "Não foi possível salvar as permissões agora."); return; }
    setUsers({ ...users, [username]: { ...users[username], permissions: newPerms } });
    setEditingPerms(null);
  }
  function copy(text, key) { navigator.clipboard?.writeText(text); setCopiedKey(key); setTimeout(() => setCopiedKey(""), 1200); }

  const entries = Object.entries(users).filter(([, u]) => u.role === role);
  const nameLabel = role === "representante" ? "Nome do representante" : role === "admin" ? "Nome do funcionário" : "Nome do cliente";

  return (
    <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 24 }}>
      <div style={{ background: "#fff", border: `1px solid ${TOKENS.line}`, borderRadius: 4, padding: 18, alignSelf: "start" }}>
        <div style={{ fontFamily: "Georgia, serif", fontSize: 16, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}><ShieldCheck size={16} color={TOKENS.wine} /> {title}</div>
        <FieldLabel>{nameLabel}</FieldLabel>
        <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} placeholder={role === "representante" ? "Ex: João Mendes" : role === "admin" ? "Ex: Maria Souza" : "Ex: Loja Bela Vista"} />
        {role === "client" && (
          <>
            <FieldLabel>Tipo de acesso</FieldLabel>
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              <button onClick={() => setAccess("atacado")} style={{ ...btnGhostSmall, flex: 1, background: access === "atacado" ? TOKENS.ivorySoft : "#fff", borderColor: access === "atacado" ? TOKENS.wine : TOKENS.line, color: access === "atacado" ? TOKENS.wine : TOKENS.graphite }}>Atacado (vê preços)</button>
              <button onClick={() => setAccess("fotos")} style={{ ...btnGhostSmall, flex: 1, background: access === "fotos" ? TOKENS.ivorySoft : "#fff", borderColor: access === "fotos" ? TOKENS.wine : TOKENS.line, color: access === "fotos" ? TOKENS.wine : TOKENS.graphite }}>Somente fotos</button>
            </div>
          </>
        )}
        {role === "representante" && <div style={{ fontSize: 11, color: TOKENS.graphite, margin: "6px 0 14px" }}>Representantes sempre veem a vitrine com preços, para montar pedidos junto aos clientes.</div>}
        {role === "admin" && (
          <>
            <FieldLabel>O que este login vai poder acessar</FieldLabel>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginBottom: 4 }}>
              <button type="button" onClick={() => setPermissions(ALL_PERMISSION_IDS)} style={{ background: "none", border: "none", color: TOKENS.wine, fontSize: 11, cursor: "pointer", padding: 0 }}>Marcar tudo</button>
              <button type="button" onClick={() => setPermissions([])} style={{ background: "none", border: "none", color: TOKENS.graphite, fontSize: 11, cursor: "pointer", padding: 0 }}>Limpar</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14, maxHeight: 220, overflowY: "auto", border: `1px solid ${TOKENS.line}`, borderRadius: 4, padding: 10 }}>
              {PERMISSION_AREAS.map((area) => (
                <label key={area.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: TOKENS.ink, cursor: "pointer" }}>
                  <input type="checkbox" checked={permissions.includes(area.id)} onChange={() => togglePerm(area.id)} />
                  {area.label}
                </label>
              ))}
            </div>
          </>
        )}
        <button onClick={generate} disabled={creating} style={{ ...btnPrimary, width: "100%", justifyContent: "center", opacity: creating ? 0.7 : 1 }}><Plus size={15} /> {creating ? "Gerando..." : "Gerar login"}</button>
        {createError && <div style={{ fontSize: 11.5, color: "#A5453F", marginTop: 8 }}>{createError}</div>}

        {lastGenerated && (
          <div style={{ marginTop: 16, background: TOKENS.ivorySoft, border: `1px solid ${TOKENS.sand}`, borderRadius: 4, padding: 12 }}>
            <div style={{ fontSize: 11, color: TOKENS.graphite, marginBottom: 6 }}>Envie estes dados para {lastGenerated.name}:</div>
            <CopyRow label="Login" value={lastGenerated.username} onCopy={() => copy(lastGenerated.username, "u")} copied={copiedKey === "u"} />
            <CopyRow label="Senha" value={lastGenerated.password} onCopy={() => copy(lastGenerated.password, "s")} copied={copiedKey === "s"} />
          </div>
        )}
      </div>

      <div>
        <div style={{ fontSize: 13, color: TOKENS.graphite, marginBottom: 10 }}>{entries.length} login(s) ativo(s)</div>
        <div style={{ background: "#fff", border: `1px solid ${TOKENS.line}`, borderRadius: 4, overflow: "hidden" }}>
          {entries.length === 0 && <div style={{ padding: 20, color: TOKENS.graphite, fontSize: 13 }}>Nenhum login gerado ainda.</div>}
          {entries.map(([username, u]) => (
            <div key={username} style={{ padding: "12px 16px", borderBottom: `1px solid ${TOKENS.ivorySoft}` }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: TOKENS.ink }}>{u.name}</div>
                  <div style={{ fontSize: 11.5, color: TOKENS.graphite }}>
                    login: {username}{role === "client" ? ` · ${u.access === "atacado" ? "vê preços" : "somente fotos"}` : ""}
                    {role === "admin" && (u.permissions ? ` · ${u.permissions.length} de ${PERMISSION_AREAS.length} áreas` : " · acesso total")}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  {role === "admin" && <button onClick={() => setEditingPerms(editingPerms === username ? null : username)} style={btnGhostSmall}><ShieldCheck size={13} /> Permissões</button>}
                  <button onClick={() => resetPassword(username)} disabled={revokingId === username} style={btnGhostSmall}><Lock size={13} /> Redefinir senha</button>
                  <button onClick={() => revoke(username)} disabled={revokingId === username} style={{ ...btnGhostSmall, color: "#A5453F" }}><Trash2 size={13} /> {revokingId === username ? "Revogando..." : "Revogar"}</button>
                </div>
              </div>
              {editingPerms === username && <EditPermissoesInline current={u.permissions || ALL_PERMISSION_IDS} onSave={(perms) => savePermissions(username, perms)} onCancel={() => setEditingPerms(null)} />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function EditPermissoesInline({ current, onSave, onCancel }) {
  const [perms, setPerms] = useState(current);
  function toggle(id) { setPerms((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]); }
  return (
    <div style={{ marginTop: 10, background: TOKENS.ivorySoft, borderRadius: 4, padding: 12 }}>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginBottom: 6 }}>
        <button type="button" onClick={() => setPerms(ALL_PERMISSION_IDS)} style={{ background: "none", border: "none", color: TOKENS.wine, fontSize: 11, cursor: "pointer", padding: 0 }}>Marcar tudo</button>
        <button type="button" onClick={() => setPerms([])} style={{ background: "none", border: "none", color: TOKENS.graphite, fontSize: 11, cursor: "pointer", padding: 0 }}>Limpar</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 10 }}>
        {PERMISSION_AREAS.map((area) => (
          <label key={area.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: TOKENS.ink, cursor: "pointer" }}>
            <input type="checkbox" checked={perms.includes(area.id)} onChange={() => toggle(area.id)} />
            {area.label}
          </label>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => onSave(perms)} style={{ ...btnPrimary, padding: "6px 14px", fontSize: 12 }} disabled={perms.length === 0}><Check size={13} /> Salvar</button>
        <button onClick={onCancel} style={btnGhostSmall}>Cancelar</button>
      </div>
    </div>
  );
}

function CopyRow({ label, value, onCopy, copied }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#fff", border: `1px solid ${TOKENS.line}`, borderRadius: 3, padding: "6px 10px", marginBottom: 6 }}>
      <span style={{ fontSize: 12 }}><b>{label}:</b> {value}</span>
      <button onClick={onCopy} style={{ background: "none", border: "none", cursor: "pointer", color: copied ? TOKENS.ok : TOKENS.graphite }}>{copied ? <Check size={14} /> : <Copy size={14} />}</button>
    </div>
  );
}

function BannersAdmin({ banners, setBanners }) {
  const fileRef = useRef();
  async function addFiles(fileList) {
    const files = Array.from(fileList).slice(0, 5 - banners.length);
    const urls = await Promise.all(files.map((f) => fileToCompressedDataUrl(f, 1400, 0.75)));
    setBanners([...banners, ...urls.map((url) => ({ id: uid("b_"), url }))]);
  }
  function remove(id) { setBanners(banners.filter((b) => b.id !== id)); }
  function move(id, dir) {
    const i = banners.findIndex((b) => b.id === id);
    const j = i + dir;
    if (j < 0 || j >= banners.length) return;
    const next = [...banners];
    [next[i], next[j]] = [next[j], next[i]];
    setBanners(next);
  }

  return (
    <div>
      <div style={{ fontSize: 13, color: TOKENS.graphite, marginBottom: 12 }}>Banner principal da vitrine — até 5 imagens, exibidas em rotação automática.</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px,1fr))", gap: 14, marginBottom: 16 }}>
        {banners.map((b, i) => (
          <div key={b.id} style={{ border: `1px solid ${TOKENS.line}`, borderRadius: 4, overflow: "hidden", background: "#fff" }}>
            <img src={b.url} style={{ width: "100%", height: 110, objectFit: "cover" }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 8px" }}>
              <div style={{ display: "flex", gap: 4 }}>
                <button onClick={() => move(b.id, -1)} disabled={i === 0} style={iconBtnStyle}><ChevronLeft size={14} /></button>
                <button onClick={() => move(b.id, 1)} disabled={i === banners.length - 1} style={iconBtnStyle}><ChevronRight size={14} /></button>
              </div>
              <button onClick={() => remove(b.id)} style={{ ...iconBtnStyle, color: "#A5453F" }}><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
        {banners.length < 5 && (
          <button onClick={() => fileRef.current.click()} style={{ height: 140, border: `1px dashed ${TOKENS.line}`, borderRadius: 4, background: TOKENS.ivorySoft, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", color: TOKENS.graphite, gap: 6 }}>
            <Upload size={18} /><span style={{ fontSize: 12 }}>Adicionar banner ({banners.length}/5)</span>
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={(e) => e.target.files.length && addFiles(e.target.files)} />
      </div>
    </div>
  );
}

/* ---------------- shared UI bits ---------------- */
function FieldLabel({ children }) { return <div style={{ fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: TOKENS.graphite, margin: "10px 0 5px" }}>{children}</div>; }

const inputStyle = { width: "100%", border: `1px solid ${TOKENS.line}`, borderRadius: 3, padding: "9px 10px", fontSize: 13.5, outline: "none", background: "#fff", boxSizing: "border-box", fontFamily: "inherit" };
const labelStyle = { display: "block", fontSize: 10.5, color: TOKENS.graphite, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 4 };
const btnPrimary = { display: "flex", alignItems: "center", gap: 6, background: TOKENS.wine, color: "#fff", border: "none", borderRadius: 3, padding: "9px 16px", fontSize: 13, cursor: "pointer" };
const btnGhostSmall = { display: "flex", alignItems: "center", gap: 5, background: "#fff", color: TOKENS.graphite, border: `1px solid ${TOKENS.line}`, borderRadius: 3, padding: "7px 11px", fontSize: 12, cursor: "pointer" };
const iconBtnStyle = { background: "none", border: "none", cursor: "pointer", color: TOKENS.graphite, display: "flex", alignItems: "center", justifyContent: "center", padding: 4 };
const overlayStyle = { position: "fixed", inset: 0, background: "rgba(23,22,26,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 };
const modalStyle = { background: TOKENS.ivory, borderRadius: 5, width: "100%", overflow: "hidden" };
const modalHeaderStyle = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: `1px solid ${TOKENS.line}`, background: "#fff" };
const modalFooterStyle = { display: "flex", justifyContent: "flex-end", gap: 10, padding: 16, borderTop: `1px solid ${TOKENS.line}`, background: "#fff" };
const thStyle = { padding: "8px 12px", fontSize: 11, textTransform: "uppercase", color: TOKENS.graphite };
const tdStyle = { padding: "8px 12px" };
