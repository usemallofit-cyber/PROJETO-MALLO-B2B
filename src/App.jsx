import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { supabase } from "./supabaseClient";
import {
  Lock, User, Upload, Plus, Trash2, Pencil, LogOut, Image as ImageIcon, Copy, Check,
  Package, Users, GalleryHorizontal, ChevronLeft, ChevronRight, X, ShieldCheck, Eye,
  ShoppingCart, Minus, Mail, MessageCircle, Printer, Settings as SettingsIcon, Download,
  Building2, UserCheck, TrendingUp, PieChart, Archive, BarChart3, Crown, UserCog
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const TOKENS = {
  ink: "#17161A", inkSoft: "#232228", ivory: "#F6F1E8", ivorySoft: "#EDE6D8",
  wine: "#8C3A3A", wineDark: "#6E2C2C", sand: "#C9B08A", graphite: "#5A564C",
  line: "#DCD2BE", ok: "#4B6355",
};

const SIZES = ["P", "M", "G", "GG"];
const CATEGORIES = ["Conjunto de Short", "Conjunto de Calça", "Macaquinhos", "KIT's"];
const MONTHS_PT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const STORE_KEYS = {
  users: "catalog_users_v5", products: "catalog_products_v5", banners: "catalog_banners_v5",
  settings: "catalog_settings_v5", clients: "catalog_clients_v5", orders: "catalog_orders_v1",
};

function uid(prefix = "") { return prefix + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4); }
function genPass() { const c = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; let s = ""; for (let i = 0; i < 6; i++) s += c[Math.floor(Math.random() * c.length)]; return s; }
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

// Camada de armazenamento — agora conversando com o Supabase (banco de dados na nuvem)
// em vez da "gaveta" interna do Claude. Guardamos cada "chave" do app (produtos,
// usuários, pedidos, etc.) como uma linha na tabela app_data, com o valor em JSONB.
// Isso mantém todo o resto do código (App, componentes, lógica) exatamente igual.
async function storageGet(key) {
  try {
    const { data, error } = await supabase.from("app_data").select("value").eq("key", key).maybeSingle();
    if (error) throw error;
    return data ? data.value : null;
  } catch (e) {
    console.error("Erro lendo do Supabase:", key, e.message || e);
    return null;
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

const SEED_USERS = {
  admincentral: { password: "central123", name: "Admin Central", role: "admincentral", access: "admin" },
  admin: { password: "admin123", name: "Administrador", role: "admin", access: "admin" },
};

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
  { key: "cnpj", label: "CNPJ" },
  { key: "ie", label: "Inscrição Estadual" },
  { key: "cpf", label: "CPF" },
  { key: "address", label: "Endereço" },
  { key: "email", label: "E-mail" },
  { key: "phone", label: "Telefone" },
  { key: "instagram", label: "Instagram" },
  { key: "references", label: "Referências comerciais" },
];

export default function App() {
  const [booted, setBooted] = useState(false);
  const [users, setUsers] = useState(SEED_USERS);
  const [products, setProducts] = useState([]);
  const [banners, setBanners] = useState([]);
  const [settings, setSettings] = useState({ orderEmail: "", orderWhatsapp: "" });
  const [clients, setClients] = useState([]);
  const [orders, setOrders] = useState([]);
  const [session, setSession] = useState(null);
  const [screen, setScreen] = useState("catalog");
  const [cart, setCart] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);

  useEffect(() => {
    (async () => {
      const [u, p, b, s, cl, ord] = await Promise.all([
        storageGet(STORE_KEYS.users, true), storageGet(STORE_KEYS.products, true),
        storageGet(STORE_KEYS.banners, true), storageGet(STORE_KEYS.settings, true),
        storageGet(STORE_KEYS.clients, true), storageGet(STORE_KEYS.orders, true),
      ]);
      const finalUsers = u || SEED_USERS;
      const finalProducts = p || SEED_PRODUCTS;
      if (!u) await storageSet(STORE_KEYS.users, finalUsers, true);
      if (!p) await storageSet(STORE_KEYS.products, finalProducts, true);
      setUsers(finalUsers); setProducts(finalProducts); setBanners(b || []);
      setSettings(s || { orderEmail: "", orderWhatsapp: "" });
      setClients(cl || []); setOrders(ord || []);
      setBooted(true);
    })();
  }, []);

  const persistUsers = useCallback(async (next) => { setUsers(next); await storageSet(STORE_KEYS.users, next, true); }, []);
  const persistProducts = useCallback(async (next) => { setProducts(next); await storageSet(STORE_KEYS.products, next, true); }, []);
  const persistBanners = useCallback(async (next) => { setBanners(next); await storageSet(STORE_KEYS.banners, next, true); }, []);
  const persistSettings = useCallback(async (next) => { setSettings(next); await storageSet(STORE_KEYS.settings, next, true); }, []);
  const persistClients = useCallback(async (next) => { setClients(next); await storageSet(STORE_KEYS.clients, next, true); }, []);
  const persistOrders = useCallback(async (next) => { setOrders(next); await storageSet(STORE_KEYS.orders, next, true); }, []);

  async function handleLogin(username) {
    const u = { username, ...users[username] };
    setSession(u);
    setSelectedClient(null);
    const savedCart = await storageGet(`cart_${username}`, false);
    setCart(savedCart || []);
  }
  function handleLogout() { setSession(null); setScreen("catalog"); setCart([]); setCartOpen(false); setSelectedClient(null); }

  const persistCart = useCallback(async (next) => {
    setCart(next);
    if (session) await storageSet(`cart_${session.username}`, next, false);
  }, [session]);

  function addToCart(product, variant, size, qty) {
    const cartItemId = `${product.id}__${variant.id}__${size}`;
    const maxQty = variant.stock[size] || 0;
    const existing = cart.find((c) => c.cartItemId === cartItemId);
    let next;
    if (existing) {
      next = cart.map((c) => c.cartItemId === cartItemId ? { ...c, qty: Math.min(maxQty, c.qty + qty) } : c);
    } else {
      next = [...cart, {
        cartItemId, productId: product.id, model: product.model, category: product.category, price: product.price,
        color: variant.color, hex: variant.hex, size, qty: Math.min(maxQty, qty),
        image: variant.images[0] || null,
      }];
    }
    persistCart(next);
    setCartOpen(true);
  }
  function updateCartQty(cartItemId, qty) { persistCart(cart.map((c) => c.cartItemId === cartItemId ? { ...c, qty: Math.max(1, qty) } : c)); }
  function removeCartItem(cartItemId) { persistCart(cart.filter((c) => c.cartItemId !== cartItemId)); }
  function clearCart() { persistCart([]); setSelectedClient(null); }

  function finalizeOrder() {
    if (!cart.length || !session) return;
    const items = cart.map((c) => {
      const prod = products.find((p) => p.id === c.productId);
      return { model: c.model, category: c.category, color: c.color, size: c.size, qty: c.qty, price: parseBRL(c.price), costPrice: prod ? parseBRL(prod.costPrice) : 0 };
    });
    const record = {
      id: uid("ord_"), date: new Date().toISOString(),
      clientName: selectedClient?.buyerName || session.name || session.username,
      sellerName: session.name || session.username, sellerRole: session.role,
      items,
    };
    persistOrders([...orders, record]);
  }

  if (!booted) {
    return <div style={{ background: TOKENS.ink, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: TOKENS.sand, fontFamily: "system-ui" }}>Carregando catálogo…</div>;
  }
  if (!session) {
    return <LoginScreen users={users} onLogin={handleLogin} />;
  }

  const showPrice = session.role === "admin" || session.role === "admincentral" || session.role === "representante" || session.access === "atacado";
  const needsClientSelect = session.role === "admin" || session.role === "admincentral" || session.role === "representante";
  const isStaff = session.role === "admin" || session.role === "admincentral";
  const clientsForCart = session.role === "representante" ? clients.filter((c) => c.repUsername === session.username) : clients;

  return (
    <div style={{ minHeight: "100vh", background: TOKENS.ivory, fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <TopBar session={session} screen={screen} setScreen={setScreen} onLogout={handleLogout} cartCount={cart.reduce((a, c) => a + c.qty, 0)} onOpenCart={() => setCartOpen(true)} />
      {screen === "admin" && isStaff ? (
        <AdminPanel users={users} setUsers={persistUsers} products={products} setProducts={persistProducts} banners={banners} setBanners={persistBanners} settings={settings} setSettings={persistSettings} clients={clients} setClients={persistClients} />
      ) : screen === "central" && session.role === "admincentral" ? (
        <AdminCentralPanel users={users} setUsers={persistUsers} products={products} setProducts={persistProducts} orders={orders} />
      ) : screen === "rep-clients" && session.role === "representante" ? (
        <RepClientsPanel clients={clients} setClients={persistClients} session={session} />
      ) : (
        <CatalogView products={products} banners={banners} session={session} addToCart={addToCart} />
      )}
      {cartOpen && (
        <CartDrawer
          cart={cart} onClose={() => setCartOpen(false)} showPrice={showPrice}
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
function LoginScreen({ users, onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPass, setShowPass] = useState(false);

  function submit() {
    const key = username.trim().toLowerCase();
    const u = users[key];
    if (!u || u.password !== password) { setError("Login ou senha inválidos."); return; }
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
          <button onClick={submit} style={{ width: "100%", marginTop: 18, background: TOKENS.wine, color: TOKENS.ivory, border: "none", borderRadius: 3, padding: "12px 0", fontSize: 13, letterSpacing: 1.5, textTransform: "uppercase", cursor: "pointer" }}>Entrar</button>
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
          {isStaff && (
  <div style={{ display: "flex", background: TOKENS.inkSoft, borderRadius: 3, padding: 3 }}>
    <button onClick={() => setScreen("catalog")} style={{ padding: "6px 14px", fontSize: 12.5, borderRadius: 2, border: "none", cursor: "pointer", background: screen === "catalog" ? TOKENS.wine : "transparent", color: TOKENS.ivory }}>Vitrine</button>
    {session.role === "admincentral" && (
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
function CatalogView({ products, banners, session, addToCart }) {
  const showPrice = session.role === "admin" || session.role === "admincentral" || session.role === "representante" || session.access === "atacado";
  const [activeCat, setActiveCat] = useState("Todas");
  const presentCats = CATEGORIES.filter((cat) => products.some((p) => p.category === cat));
  const filtered = activeCat === "Todas" ? products : products.filter((p) => p.category === activeCat);
  const grouped = activeCat === "Todas"
    ? presentCats.map((cat) => ({ cat, items: products.filter((p) => p.category === cat) }))
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

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", borderBottom: `1px solid ${TOKENS.line}`, paddingBottom: 16, marginBottom: 26 }}>
          <CategoryPill active={activeCat === "Todas"} onClick={() => setActiveCat("Todas")}>Todas</CategoryPill>
          {CATEGORIES.map((cat) => <CategoryPill key={cat} active={activeCat === cat} onClick={() => setActiveCat(cat)}>{cat}</CategoryPill>)}
        </div>

        {products.length === 0 ? (
          <div style={{ color: TOKENS.graphite, padding: 40, textAlign: "center" }}>Nenhum modelo cadastrado ainda.</div>
        ) : filtered.length === 0 ? (
          <div style={{ color: TOKENS.graphite, padding: 40, textAlign: "center" }}>Nenhum modelo nesta categoria ainda.</div>
        ) : (
          grouped.map(({ cat, items }) => items.length === 0 ? null : (
            <div key={cat} style={{ marginBottom: 34 }}>
              {activeCat === "Todas" && <div style={{ fontFamily: "Georgia, serif", fontSize: 19, color: TOKENS.ink, marginBottom: 14, borderLeft: `3px solid ${TOKENS.wine}`, paddingLeft: 10 }}>{cat}</div>}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: 22 }}>
                {items.map((p) => <ProductCard key={p.id} p={p} showPrice={showPrice} addToCart={addToCart} />)}
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

function ProductCard({ p, showPrice, addToCart }) {
  const variants = p.variants && p.variants.length ? p.variants : [{ id: "none", color: "", hex: TOKENS.line, images: [], stock: {} }];
  const [vIdx, setVIdx] = useState(0);
  const [imgIdx, setImgIdx] = useState(0);
  const [size, setSize] = useState(null);
  const [qty, setQty] = useState(1);
  const variant = variants[vIdx];
  const imgs = variant.images && variant.images.length ? variant.images : [null];

  useEffect(() => { setImgIdx(0); setSize(null); setQty(1); }, [vIdx]);

  const maxQty = size ? (variant.stock[size] || 0) : 0;

  return (
    <div style={{ background: "#fff", border: `1px solid ${TOKENS.line}`, borderRadius: 4, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <div style={{ position: "relative", aspectRatio: "3/8", background: TOKENS.ivorySoft, display: "flex", alignItems: "center", justifyContent: "center" }}>
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
        <div style={{ fontFamily: "Georgia, serif", fontSize: 17, color: TOKENS.ink }}>{p.model}</div>
        <div style={{ fontSize: 12.5, color: TOKENS.graphite, marginTop: 4, lineHeight: 1.4, minHeight: 32 }}>{p.description}</div>

        {variant.color && (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 10.5, color: TOKENS.graphite, marginBottom: 5 }}>Cor: <b style={{ color: TOKENS.ink }}>{variant.color}</b></div>
            <div style={{ display: "flex", gap: 8 }}>
              {variants.map((v, i) => (
                <button key={v.id} onClick={() => setVIdx(i)} title={v.color} style={{
                  width: 22, height: 22, borderRadius: "50%", background: v.hex, cursor: "pointer",
                  border: i === vIdx ? `2px solid ${TOKENS.wine}` : `1px solid ${TOKENS.line}`,
                  boxShadow: i === vIdx ? "0 0 0 2px #fff inset" : "none", outline: "none",
                }} />
              ))}
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: 6, marginTop: 12, borderTop: `1px dashed ${TOKENS.line}`, paddingTop: 10 }}>
          {SIZES.map((s) => {
            const stockQty = variant.stock ? (variant.stock[s] || 0) : 0;
            const out = !stockQty;
            const selected = size === s;
            return (
              <button key={s} disabled={out} onClick={() => setSize(s)} style={{
                flex: 1, textAlign: "center", padding: "5px 0", borderRadius: 3, cursor: out ? "default" : "pointer",
                background: out ? "#F1EDE4" : selected ? TOKENS.wine : TOKENS.ivorySoft,
                color: out ? "#B8AF9C" : selected ? "#fff" : TOKENS.ink,
                fontSize: 11.5, fontWeight: 600, textDecoration: out ? "line-through" : "none", border: "none",
              }}>{s}</button>
            );
          })}
        </div>

        {showPrice && <div style={{ marginTop: 12, fontFamily: "Georgia, serif", fontSize: 19, color: TOKENS.wine }}>R$ {p.price}</div>}

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12 }}>
          <div style={{ display: "flex", alignItems: "center", border: `1px solid ${TOKENS.line}`, borderRadius: 3 }}>
            <button onClick={() => setQty((q) => Math.max(1, q - 1))} style={qtyBtnStyle}><Minus size={12} /></button>
            <span style={{ width: 26, textAlign: "center", fontSize: 12.5 }}>{qty}</span>
            <button onClick={() => setQty((q) => Math.min(maxQty || 1, q + 1))} style={qtyBtnStyle}><Plus size={12} /></button>
          </div>
          <button
            disabled={!size || !p.variants?.length}
            onClick={() => { addToCart(p, variant, size, qty); }}
            style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: size ? TOKENS.wine : TOKENS.line, color: "#fff", border: "none", borderRadius: 3, padding: "9px 0", fontSize: 12.5, cursor: size ? "pointer" : "default" }}>
            <ShoppingCart size={13} /> Adicionar
          </button>
        </div>
        {!size && p.variants?.length > 0 && <div style={{ fontSize: 10.5, color: TOKENS.graphite, marginTop: 6 }}>Selecione um tamanho disponível</div>}
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

function CartDrawer({ cart, onClose, showPrice, updateCartQty, removeCartItem, clearCart, settings, session, clients, needsClientSelect, selectedClient, setSelectedClient, onFinalizeOrder }) {
  const [step, setStep] = useState("list");
  const [downloading, setDownloading] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
  const [sendError, setSendError] = useState("");
  const total = cart.reduce((a, c) => a + parseBRL(c.price) * c.qty, 0);
  const orderText = useMemo(() => buildOrderText(cart, session, showPrice, selectedClient), [cart, session, showPrice, selectedClient]);
  const orderEmail = (settings.orderEmail || "").trim();
  const mailHref = `mailto:${orderEmail}?subject=${encodeURIComponent(`Novo pedido - ${session.name || session.username}`)}&body=${encodeURIComponent(orderText)}`;
  const waDigits = (settings.orderWhatsapp || "").replace(/\D/g, "");
  const waHref = `https://wa.me/${waDigits}?text=${encodeURIComponent(orderText)}`;
  const hasEmail = orderEmail.length > 3 && orderEmail.includes("@");
  const hasWhats = waDigits.length >= 10;
  const clientReady = !needsClientSelect || !!selectedClient;

  async function downloadImage() {
    setDownloading(true);
    try {
      const url = await buildOrderImage(cart, session, showPrice, selectedClient);
      const a = document.createElement("a");
      a.href = url; a.download = `pedido-${(session.name || session.username).replace(/\s+/g, "-").toLowerCase()}.png`;
      document.body.appendChild(a); a.click(); a.remove();
    } finally { setDownloading(false); }
  }
  function downloadPdf() { window.print(); }

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
  function sendWhatsapp() {
    setSendError("");
    if (!hasWhats) return;
    try {
      const win = window.open(waHref, "_blank", "noopener,noreferrer");
      if (!win) setSendError('Não foi possível abrir o WhatsApp automaticamente. Use "Copiar texto do pedido" e cole numa conversa do WhatsApp.');
    } catch (e) {
      setSendError('Não foi possível abrir o WhatsApp automaticamente. Use "Copiar texto do pedido" e cole numa conversa do WhatsApp.');
    }
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
              {cart.map((c) => (
                <div key={c.cartItemId} style={{ display: "flex", gap: 10, background: "#fff", border: `1px solid ${TOKENS.line}`, borderRadius: 4, padding: 10, marginBottom: 10 }}>
                  <div style={{ width: 54, height: 68, background: TOKENS.ivorySoft, borderRadius: 3, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                    {c.image ? <img src={c.image} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <ImageIcon size={18} color={TOKENS.line} />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: TOKENS.ink }}>{c.model}</div>
                    <div style={{ fontSize: 11, color: TOKENS.graphite, display: "flex", alignItems: "center", gap: 5, margin: "3px 0" }}>
                      <span style={{ width: 10, height: 10, borderRadius: "50%", background: c.hex, display: "inline-block", border: `1px solid ${TOKENS.line}` }} /> {c.color} · Tam {c.size}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 6 }}>
                      <div style={{ display: "flex", alignItems: "center", border: `1px solid ${TOKENS.line}`, borderRadius: 3 }}>
                        <button onClick={() => updateCartQty(c.cartItemId, c.qty - 1)} style={qtyBtnStyle}><Minus size={11} /></button>
                        <span style={{ width: 22, textAlign: "center", fontSize: 12 }}>{c.qty}</span>
                        <button onClick={() => updateCartQty(c.cartItemId, c.qty + 1)} style={qtyBtnStyle}><Plus size={11} /></button>
                      </div>
                      {showPrice && <div style={{ fontSize: 12.5, color: TOKENS.wine, fontWeight: 600 }}>R$ {formatBRL(parseBRL(c.price) * c.qty)}</div>}
                      <button onClick={() => removeCartItem(c.cartItemId)} style={{ background: "none", border: "none", color: "#A5453F", cursor: "pointer" }}><Trash2 size={14} /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {cart.length > 0 && (
              <div style={{ padding: 16, borderTop: `1px solid ${TOKENS.line}`, background: "#fff" }}>
                {showPrice && <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12, fontSize: 15 }}><span>Total</span><b style={{ color: TOKENS.wine, fontFamily: "Georgia, serif", fontSize: 19 }}>R$ {formatBRL(total)}</b></div>}
                <button onClick={() => { onFinalizeOrder(); setStep("finalize"); }} disabled={!clientReady} title={!clientReady ? "Selecione um cliente para este pedido" : ""} style={{ ...btnPrimary, width: "100%", justifyContent: "center", opacity: clientReady ? 1 : 0.5, cursor: clientReady ? "pointer" : "not-allowed" }}>Finalizar pedido</button>
                {!clientReady && <div style={{ fontSize: 11, color: "#A5453F", marginTop: 6, textAlign: "center" }}>Selecione o cliente acima para continuar.</div>}
                <button onClick={() => { if (confirm("Esvaziar o carrinho?")) clearCart(); }} style={{ ...btnGhostSmall, width: "100%", justifyContent: "center", marginTop: 8 }}>Esvaziar carrinho</button>
              </div>
            )}
          </>
        )}

        {step === "finalize" && (
          <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
            {selectedClient && (
              <div style={{ background: TOKENS.ivorySoft, border: `1px solid ${TOKENS.sand}`, borderRadius: 4, padding: 10, marginBottom: 14, fontSize: 12 }}>
                <b>{selectedClient.buyerName}</b>{selectedClient.cnpj ? ` · CNPJ ${selectedClient.cnpj}` : ""}{selectedClient.phone ? ` · ${selectedClient.phone}` : ""}
              </div>
            )}
            <div style={{ fontSize: 12, color: TOKENS.graphite, marginBottom: 12 }}>Fotos principais dos itens:</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
              {cart.map((c) => (
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
              E-mail e WhatsApp abrem só com o texto do pedido — não é possível embutir fotos dentro dessas mensagens. Use o PDF ou o PNG abaixo (já com a foto principal de cada peça) para anexar.
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              <button onClick={downloadPdf} style={{ ...btnGhostSmall, flex: 1, justifyContent: "center", padding: "10px 0" }}><Printer size={14} /> Baixar em PDF</button>
              <button onClick={downloadImage} disabled={downloading} style={{ ...btnGhostSmall, flex: 1, justifyContent: "center", padding: "10px 0" }}><Download size={14} /> {downloading ? "Gerando..." : "Baixar PNG"}</button>
            </div>
            <div style={{ fontSize: 10.5, color: TOKENS.graphite, marginTop: -8, marginBottom: 14 }}>No PDF, escolha "Salvar como PDF" como impressora na janela que abrir.</div>

            {sendError && <div style={{ fontSize: 11.5, color: "#A5453F", background: "#FBEAEA", border: "1px solid #E3B3B3", borderRadius: 3, padding: 10, marginBottom: 12 }}>{sendError}</div>}

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button onClick={sendEmail} disabled={!hasEmail} title={!hasEmail ? "Administrador ainda não cadastrou o e-mail em Configurações" : ""} style={{ ...btnPrimary, justifyContent: "center", opacity: hasEmail ? 1 : 0.45, cursor: hasEmail ? "pointer" : "not-allowed" }}>
                <Mail size={15} /> Enviar por e-mail{hasEmail ? ` (${orderEmail})` : ""}
              </button>
              <button onClick={sendWhatsapp} disabled={!hasWhats} title={!hasWhats ? "Administrador ainda não cadastrou o WhatsApp em Configurações" : ""} style={{ ...btnPrimary, background: "#3E7A5C", justifyContent: "center", opacity: hasWhats ? 1 : 0.45, cursor: hasWhats ? "pointer" : "not-allowed" }}>
                <MessageCircle size={15} /> Enviar por WhatsApp
              </button>
              <button onClick={copyOrderText} style={{ ...btnGhostSmall, justifyContent: "center", padding: "10px 0", color: copiedText ? TOKENS.ok : TOKENS.graphite }}>
                <Copy size={13} /> {copiedText ? "Texto copiado!" : "Copiar texto do pedido"}
              </button>
            </div>
            <div style={{ fontSize: 10.5, color: TOKENS.graphite, marginTop: 10, lineHeight: 1.5 }}>
              Se o botão de e-mail ou WhatsApp não abrir (comum quando o dispositivo não tem um app padrão configurado), use "Copiar texto do pedido" e cole manualmente numa nova mensagem.
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
function AdminPanel({ users, setUsers, products, setProducts, banners, setBanners, settings, setSettings, clients, setClients }) {
  const [tab, setTab] = useState("produtos");
  const tabs = [
    { id: "produtos", label: "Produtos & Estoque", icon: Package },
    { id: "clientes", label: "Clientes (Cadastro)", icon: Building2 },
    { id: "login-clientes", label: "Login de Clientes", icon: Users },
    { id: "representantes", label: "Login de Representantes", icon: UserCheck },
    { id: "banners", label: "Banners", icon: GalleryHorizontal },
    { id: "config", label: "Configurações", icon: SettingsIcon },
  ];
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
      {tab === "produtos" && <ProdutosAdmin products={products} setProducts={setProducts} />}
      {tab === "clientes" && <ClientRegistryAdmin clients={clients} setClients={setClients} users={users} repFilterEnabled />}
      {tab === "login-clientes" && <ClientesAdmin users={users} setUsers={setUsers} role="client" title="Login de Clientes" />}
      {tab === "representantes" && <ClientesAdmin users={users} setUsers={setUsers} role="representante" title="Login de Representantes" />}
      {tab === "banners" && <BannersAdmin banners={banners} setBanners={setBanners} />}
      {tab === "config" && <SettingsAdmin settings={settings} setSettings={setSettings} />}
    </div>
  );
}

/* ---------------- ADMIN CENTRAL ---------------- */
function AdminCentralPanel({ users, setUsers, products, setProducts, orders }) {
  const [tab, setTab] = useState("funcionarios");
  const tabs = [
    { id: "funcionarios", label: "Login de Funcionários", icon: UserCog },
    { id: "ranking", label: "Ranking de Vendas", icon: TrendingUp },
    { id: "abc", label: "Curva ABC", icon: PieChart },
    { id: "estoque", label: "Estoque & Custos", icon: Archive },
    { id: "vendas-mes", label: "Vendas por Mês", icon: BarChart3 },
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
      {tab === "funcionarios" && <ClientesAdmin users={users} setUsers={setUsers} role="admin" title="Login de Funcionários" />}
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

function SettingsAdmin({ settings, setSettings }) {
  const [email, setEmail] = useState(settings.orderEmail || "");
  const [whats, setWhats] = useState(settings.orderWhatsapp || "");
  const [saved, setSaved] = useState(false);
  function save() { setSettings({ orderEmail: email.trim(), orderWhatsapp: whats.trim() }); setSaved(true); setTimeout(() => setSaved(false), 1500); }
  return (
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

  function startNew() { setEditing({ id: uid("cl_"), buyerName: "", cnpj: "", ie: "", cpf: "", address: "", email: "", phone: "", instagram: "", references: "", repUsername: repScope || "" }); setShowForm(true); }
  function startEdit(c) { setEditing({ ...c }); setShowForm(true); }
  function remove(id) { if (confirm("Remover este cliente do cadastro?")) setClients(clients.filter((c) => c.id !== id)); }
  function save(c) {
    if (!c.buyerName.trim()) return;
    const exists = clients.some((x) => x.id === c.id);
    setClients(exists ? clients.map((x) => (x.id === c.id ? c : x)) : [c, ...clients]);
    setShowForm(false); setEditing(null);
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

function ClientForm({ initial, onCancel, onSave }) {
  const [c, setC] = useState(initial);
  return (
    <div style={overlayStyle}>
      <div style={{ ...modalStyle, maxWidth: 560 }}>
        <div style={modalHeaderStyle}>
          <div style={{ fontFamily: "Georgia, serif", fontSize: 18 }}>{initial.buyerName ? "Editar cliente" : "Novo cliente"}</div>
          <button onClick={onCancel} style={iconBtnStyle}><X size={18} /></button>
        </div>
        <div style={{ padding: 20, maxHeight: "72vh", overflowY: "auto" }}>
          {CLIENT_FIELDS.map((f) => (
            <div key={f.key}>
              <FieldLabel>{f.label}</FieldLabel>
              {f.key === "references" ? (
                <textarea value={c[f.key]} onChange={(e) => setC({ ...c, [f.key]: e.target.value })} style={{ ...inputStyle, minHeight: 60, resize: "vertical" }} />
              ) : (
                <input value={c[f.key]} onChange={(e) => setC({ ...c, [f.key]: e.target.value })} style={inputStyle} />
              )}
            </div>
          ))}
        </div>
        <div style={modalFooterStyle}>
          <button onClick={onCancel} style={btnGhostSmall}>Cancelar</button>
          <button onClick={() => onSave(c)} style={btnPrimary} disabled={!c.buyerName.trim()}><Check size={15} /> Salvar cliente</button>
        </div>
      </div>
    </div>
  );
}

function ProdutosAdmin({ products, setProducts }) {
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [filterCat, setFilterCat] = useState("Todas");

  function startNew() { setEditing({ id: uid("p_"), model: "", category: CATEGORIES[0], description: "", price: "", costPrice: "", variants: [] }); setShowForm(true); }
  function startEdit(p) { setEditing({ ...p, variants: p.variants.map((v) => ({ ...v, stock: { ...v.stock } })) }); setShowForm(true); }
  function remove(id) { if (confirm("Remover este produto do catálogo?")) setProducts(products.filter((p) => p.id !== id)); }
  function save(p) {
    const exists = products.some((x) => x.id === p.id);
    setProducts(exists ? products.map((x) => (x.id === p.id ? p : x)) : [p, ...products]);
    setShowForm(false); setEditing(null);
  }

  const list = filterCat === "Todas" ? products : products.filter((p) => p.category === filterCat);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <div style={{ fontSize: 13, color: TOKENS.graphite }}>{list.length} modelo(s)</div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <select value={filterCat} onChange={(e) => setFilterCat(e.target.value)} style={{ ...inputStyle, width: "auto", padding: "8px 10px" }}>
            <option>Todas</option>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
          <button onClick={startNew} style={btnPrimary}><Plus size={15} /> Novo modelo</button>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px,1fr))", gap: 22 }}>
        {list.map((p) => (
          <div key={p.id} style={{ background: "#fff", border: `1px solid ${TOKENS.line}`, borderRadius: 4, overflow: "hidden" }}>
            <div style={{ aspectRatio: "3/8", background: TOKENS.ivorySoft, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {p.variants?.[0]?.images?.[0] ? <img src={p.variants[0].images[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <ImageIcon size={28} color={TOKENS.line} />}
            </div>
            <div style={{ padding: 12 }}>
              <div style={{ fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: TOKENS.wine, marginBottom: 3 }}>{p.category}</div>
              <div style={{ fontWeight: 600, fontSize: 14, color: TOKENS.ink }}>{p.model || "(sem nome)"}</div>
              <div style={{ fontSize: 11.5, color: TOKENS.graphite, margin: "4px 0 6px" }}>R$ {p.price || "0,00"}</div>
              <div style={{ display: "flex", gap: 5, marginBottom: 10 }}>
                {(p.variants || []).map((v) => <span key={v.id} title={v.color} style={{ width: 14, height: 14, borderRadius: "50%", background: v.hex, border: `1px solid ${TOKENS.line}` }} />)}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => startEdit(p)} style={btnGhostSmall}><Pencil size={13} /> Editar</button>
                <button onClick={() => remove(p.id)} style={{ ...btnGhostSmall, color: "#A5453F" }}><Trash2 size={13} /> Excluir</button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {showForm && <ProductForm initial={editing} onCancel={() => { setShowForm(false); setEditing(null); }} onSave={save} />}
    </div>
  );
}

function ProductForm({ initial, onCancel, onSave }) {
  const [p, setP] = useState(initial);

  function addVariant() { setP((s) => ({ ...s, variants: [...s.variants, { id: uid("v_"), color: "", hex: "#8C3A3A", images: [], stock: { P: 0, M: 0, G: 0, GG: 0 } }] })); }
  function removeVariant(id) { setP((s) => ({ ...s, variants: s.variants.filter((v) => v.id !== id) })); }
  function updateVariant(id, patch) { setP((s) => ({ ...s, variants: s.variants.map((v) => v.id === id ? { ...v, ...patch } : v) })); }
  function setVariantStock(id, size, val) { setP((s) => ({ ...s, variants: s.variants.map((v) => v.id === id ? { ...v, stock: { ...v.stock, [size]: Math.max(0, Number(val) || 0) } } : v) })); }
  async function addVariantImages(id, fileList, current) {
    const files = Array.from(fileList).slice(0, 4 - current.length);
    const dataUrls = await Promise.all(files.map((f) => fileToCompressedDataUrl(f)));
    updateVariant(id, { images: [...current, ...dataUrls] });
  }
  function removeVariantImage(id, idx, current) { updateVariant(id, { images: current.filter((_, i) => i !== idx) }); }

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
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>

          <FieldLabel>Nome do modelo</FieldLabel>
          <input value={p.model} onChange={(e) => setP({ ...p, model: e.target.value })} style={inputStyle} placeholder="Ex: Vestido Aurora" />

          <FieldLabel>Descrição</FieldLabel>
          <textarea value={p.description} onChange={(e) => setP({ ...p, description: e.target.value })} style={{ ...inputStyle, minHeight: 58, resize: "vertical" }} placeholder="Tecido, caimento, detalhes..." />

          <FieldLabel>Preço (atacado)</FieldLabel>
          <input value={p.price} onChange={(e) => setP({ ...p, price: e.target.value })} style={inputStyle} placeholder="0,00" />
          <div style={{ fontSize: 10.5, color: TOKENS.graphite, marginTop: 4 }}>O preço de custo é definido separadamente no Painel Central, por quem tem acesso de Admin Central.</div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "18px 0 8px" }}>
            <FieldLabel>Cores e fotos por cor</FieldLabel>
            <button onClick={addVariant} style={btnGhostSmall}><Plus size={13} /> Adicionar cor</button>
          </div>

          {p.variants.length === 0 && <div style={{ fontSize: 12, color: TOKENS.graphite, padding: 12, background: TOKENS.ivorySoft, borderRadius: 3 }}>Nenhuma cor adicionada. Cadastre pelo menos uma cor com suas fotos e estoque.</div>}

          {p.variants.map((v) => (
            <VariantEditor key={v.id} v={v}
              onChange={(patch) => updateVariant(v.id, patch)}
              onRemove={() => removeVariant(v.id)}
              onAddImages={(files) => addVariantImages(v.id, files, v.images)}
              onRemoveImage={(idx) => removeVariantImage(v.id, idx, v.images)}
              onSetStock={(size, val) => setVariantStock(v.id, size, val)}
            />
          ))}
        </div>
        <div style={modalFooterStyle}>
          <button onClick={onCancel} style={btnGhostSmall}>Cancelar</button>
          <button onClick={() => onSave(p)} style={btnPrimary} disabled={!p.model.trim()}><Check size={15} /> Salvar modelo</button>
        </div>
      </div>
    </div>
  );
}

function VariantEditor({ v, onChange, onRemove, onAddImages, onRemoveImage, onSetStock }) {
  const fileRef = useRef();
  return (
    <div style={{ border: `1px solid ${TOKENS.line}`, borderRadius: 4, padding: 14, marginBottom: 12, background: TOKENS.ivorySoft }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
          <input type="color" value={v.hex} onChange={(e) => onChange({ hex: e.target.value })} style={{ width: 34, height: 34, border: "none", padding: 0, background: "none", cursor: "pointer", borderRadius: "50%" }} />
          <input value={v.color} onChange={(e) => onChange({ color: e.target.value })} placeholder="Nome da cor (ex: Vermelho)" style={{ ...inputStyle, maxWidth: 220 }} />
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

      <div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: 1, color: TOKENS.graphite, marginBottom: 6 }}>Estoque por tamanho</div>
      <div style={{ display: "flex", gap: 8 }}>
        {SIZES.map((s) => (
          <div key={s} style={{ flex: 1 }}>
            <div style={{ fontSize: 10.5, textAlign: "center", color: TOKENS.graphite, marginBottom: 3 }}>{s}</div>
            <input type="number" min={0} value={v.stock[s]} onChange={(e) => onSetStock(s, e.target.value)} style={{ ...inputStyle, textAlign: "center", padding: "7px 4px", background: "#fff" }} />
          </div>
        ))}
      </div>
    </div>
  );
}

function ClientesAdmin({ users, setUsers, role, title }) {
  const [name, setName] = useState("");
  const [access, setAccess] = useState("atacado");
  const [lastGenerated, setLastGenerated] = useState(null);
  const [copiedKey, setCopiedKey] = useState("");

  function generate() {
    if (!name.trim()) return;
    const base = name.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, ".").replace(/(^\.|\.$)/g, "");
    let username = base || uid(role === "representante" ? "rep_" : role === "admin" ? "func_" : "cli_");
    let n = 1;
    while (users[username]) { username = `${base}${n}`; n++; }
    const password = genPass();
    const finalAccess = role === "representante" ? "atacado" : access;
    const next = { ...users, [username]: { password, name: name.trim(), role, access: finalAccess } };
    setUsers(next);
    setLastGenerated({ username, password, name: name.trim(), access: finalAccess });
    setName("");
  }
  function revoke(username) { if (confirm(`Revogar acesso de "${username}"?`)) { const n = { ...users }; delete n[username]; setUsers(n); } }
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
        {role === "admin" && <div style={{ fontSize: 11, color: TOKENS.graphite, margin: "6px 0 14px" }}>Funcionários acessam o Painel ADM normalmente, mas sem preço de custo nem os relatórios gerenciais (isso fica só no Painel Central).</div>}
        <button onClick={generate} style={{ ...btnPrimary, width: "100%", justifyContent: "center" }}><Plus size={15} /> Gerar login</button>

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
            <div key={username} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: `1px solid ${TOKENS.ivorySoft}` }}>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: TOKENS.ink }}>{u.name}</div>
                <div style={{ fontSize: 11.5, color: TOKENS.graphite }}>login: {username} · senha: {u.password}{role === "client" ? ` · ${u.access === "atacado" ? "vê preços" : "somente fotos"}` : ""}</div>
              </div>
              <button onClick={() => revoke(username)} style={{ ...btnGhostSmall, color: "#A5453F" }}><Trash2 size={13} /> Revogar</button>
            </div>
          ))}
        </div>
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
const btnPrimary = { display: "flex", alignItems: "center", gap: 6, background: TOKENS.wine, color: "#fff", border: "none", borderRadius: 3, padding: "9px 16px", fontSize: 13, cursor: "pointer" };
const btnGhostSmall = { display: "flex", alignItems: "center", gap: 5, background: "#fff", color: TOKENS.graphite, border: `1px solid ${TOKENS.line}`, borderRadius: 3, padding: "7px 11px", fontSize: 12, cursor: "pointer" };
const iconBtnStyle = { background: "none", border: "none", cursor: "pointer", color: TOKENS.graphite, display: "flex", alignItems: "center", justifyContent: "center", padding: 4 };
const overlayStyle = { position: "fixed", inset: 0, background: "rgba(23,22,26,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 };
const modalStyle = { background: TOKENS.ivory, borderRadius: 5, width: "100%", overflow: "hidden" };
const modalHeaderStyle = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: `1px solid ${TOKENS.line}`, background: "#fff" };
const modalFooterStyle = { display: "flex", justifyContent: "flex-end", gap: 10, padding: 16, borderTop: `1px solid ${TOKENS.line}`, background: "#fff" };
const thStyle = { padding: "8px 12px", fontSize: 11, textTransform: "uppercase", color: TOKENS.graphite };
const tdStyle = { padding: "8px 12px" };
