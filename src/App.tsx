// @ts-nocheck
import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Plus,
  Trash2,
  Edit,
  Download,
  Upload,
  Filter,
  Wallet,
  ArrowUpCircle,
  ArrowDownCircle,
  RefreshCcw,
  PieChart as PieChartIcon,
  BarChart as BarChartIcon,
  Search,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";

// ===== Utilities =====
const LS_KEY_ENTRIES = "ie_entries_v1";
const LS_KEY_CATEGORIES = "ie_categories_v1";

const thaiCurrency = new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: "THB",
  maximumFractionDigits: 2,
});

const fmtMoney = (n) => thaiCurrency.format(Number(n || 0));
const todayStr = () => new Date().toISOString().slice(0, 10);

function startOfWeek(d = new Date()) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // Monday=0
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfWeek(d = new Date()) {
  const x = startOfWeek(d);
  x.setDate(x.getDate() + 6);
  x.setHours(23, 59, 59, 999);
  return x;
}
function startOfMonth(d = new Date()) {
  const x = new Date(d.getFullYear(), d.getMonth(), 1);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfMonth(d = new Date()) {
  const x = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  x.setHours(23, 59, 59, 999);
  return x;
}

function parseDate(str) {
  // Accepts YYYY-MM-DD
  const [y, m, d] = (str || "").split("-").map((v) => parseInt(v, 10));
  if (!y || !m || !d) return new Date(NaN);
  return new Date(y, m - 1, d);
}

function downloadBlob(filename, text, mime = "text/plain") {
  const blob = new Blob([text], { type: mime + ";charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const DEFAULT_CATEGORIES = {
  income: ["เงินเดือน", "โบนัส", "ขายของ", "ดอกเบี้ย", "อื่น ๆ"],
  expense: ["อาหาร", "เดินทาง", "บิล", "ช้อปปิ้ง", "บันเทิง", "สุขภาพ", "การศึกษา", "อื่น ๆ"],
};

const COLORS = [
  "#2563eb",
  "#16a34a",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#f97316",
  "#22c55e",
  "#e11d48",
  "#0ea5e9",
];

// ===== Main App =====
export default function ExpenseTracker() {
  const [entries, setEntries] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(LS_KEY_ENTRIES) || "[]");
    } catch {
      return [];
    }
  });

  const [categories, setCategories] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(LS_KEY_CATEGORIES) || "null") || DEFAULT_CATEGORIES;
    } catch {
      return DEFAULT_CATEGORIES;
    }
  });

  const [form, setForm] = useState({
    type: "expense",
    date: todayStr(),
    category: "อาหาร",
    note: "",
    amount: "",
  });

  const [filters, setFilters] = useState({
    q: "",
    type: "all",
    cat: "all",
    from: "",
    to: "",
  });

  const [editId, setEditId] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [showAddCat, setShowAddCat] = useState(false);
  const [newCat, setNewCat] = useState("");
  const [pendingCatDelete, setPendingCatDelete] = useState(null);
  const amountRef = useRef(null);

  useEffect(() => {
    localStorage.setItem(LS_KEY_ENTRIES, JSON.stringify(entries));
  }, [entries]);

  useEffect(() => {
    localStorage.setItem(LS_KEY_CATEGORIES, JSON.stringify(categories));
  }, [categories]);

  useEffect(() => {
    // Set default category when type changes
    const list = categories[form.type] || [];
    if (!list.includes(form.category)) {
      setForm((f) => ({ ...f, category: list[0] || "อื่น ๆ" }));
    }
  }, [form.type]);

  const totals = useMemo(() => {
    const inc = entries.filter((e) => e.type === "income").reduce((s, e) => s + Number(e.amount || 0), 0);
    const exp = entries.filter((e) => e.type === "expense").reduce((s, e) => s + Number(e.amount || 0), 0);
    return { inc, exp, net: inc - exp };
  }, [entries]);

  const monthTotals = useMemo(() => {
    const from = startOfMonth(new Date());
    const to = endOfMonth(new Date());
    const inRange = entries.filter((e) => {
      const d = parseDate(e.date);
      return d >= from && d <= to;
    });
    const inc = inRange.filter((e) => e.type === "income").reduce((s, e) => s + Number(e.amount || 0), 0);
    const exp = inRange.filter((e) => e.type === "expense").reduce((s, e) => s + Number(e.amount || 0), 0);
    return { inc, exp, net: inc - exp };
  }, [entries]);

  const filtered = useMemo(() => {
    return entries
      .filter((e) => {
        if (filters.type !== "all" && e.type !== filters.type) return false;
        if (filters.cat !== "all" && e.category !== filters.cat) return false;
        if (filters.q) {
          const q = filters.q.toLowerCase();
          const hay = `${e.note} ${e.category}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        if (filters.from) {
          const d = parseDate(e.date);
          if (d < parseDate(filters.from)) return false;
        }
        if (filters.to) {
          const d = parseDate(e.date);
          if (d > parseDate(filters.to)) return false;
        }
        return true;
      })
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  }, [entries, filters]);

  const rangeLabel = useMemo(() => (filters.from || filters.to) ? "ตามตัวกรอง" : "เดือนนี้", [filters]);

  const rangeTotals = useMemo(() => {
    const inc = filtered.filter((e) => e.type === "income").reduce((s, e) => s + Number(e.amount || 0), 0);
    const exp = filtered.filter((e) => e.type === "expense").reduce((s, e) => s + Number(e.amount || 0), 0);
    return { inc, exp, net: inc - exp };
  }, [filtered]);

  const dailySeries = useMemo(() => {
    const map = new Map();
    for (const e of filtered) {
      const key = e.date;
      if (!map.has(key)) map.set(key, { date: key, รายรับ: 0, รายจ่าย: 0 });
      map.get(key)[e.type === "income" ? "รายรับ" : "รายจ่าย"] += Number(e.amount || 0);
    }
    return Array.from(map.values()).sort((a, b) => (a.date < b.date ? -1 : 1));
  }, [filtered]);

  const pieSeries = useMemo(() => {
    const map = new Map();
    for (const e of filtered) {
      if (e.type !== "expense") continue;
      map.set(e.category, (map.get(e.category) || 0) + Number(e.amount || 0));
    }
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [filtered]);

  // ===== Handlers =====
  const addEntry = () => {
    const amount = Number(form.amount);
    if (!form.date || !form.category || !amount) return;
    const newItem = {
      id: crypto.randomUUID(),
      ...form,
      amount: Math.abs(amount),
    };
    setEntries((arr) => [newItem, ...arr]);
    setForm((f) => ({ ...f, note: "", amount: "" }));
    amountRef.current?.focus();
  };

  const startEdit = (id) => {
    const e = entries.find((x) => x.id === id);
    if (!e) return;
    setEditId(id);
    setForm({ type: e.type, date: e.date, category: e.category, note: e.note, amount: String(e.amount) });
  };

  const saveEdit = () => {
    if (!editId) return;
    const amount = Number(form.amount);
    if (!form.date || !form.category || !amount) return;
    setEntries((arr) => arr.map((x) => (x.id === editId ? { ...x, ...form, amount: Math.abs(amount) } : x)));
    setEditId(null);
    setForm((f) => ({ ...f, note: "", amount: "" }));
  };

  const askDelete = (id) => setPendingDelete(id);

  const confirmDelete = () => {
    if (!pendingDelete) return;
    setEntries((arr) => arr.filter((x) => x.id !== pendingDelete));
    setPendingDelete(null);
  };

  const cancelDelete = () => setPendingDelete(null);

  const addCategory = () => { setShowAddCat(true); setNewCat(""); };

  const saveNewCategory = () => {
    const name = (newCat || "").trim();
    if (!name) { alert("กรอกชื่อหมวดหมู่ก่อน"); return; }
    setCategories((c) => {
      const setArr = new Set([...(c[form.type] || []), name]);
      return { ...c, [form.type]: Array.from(setArr) };
    });
    setForm((f) => ({ ...f, category: name }));
    setShowAddCat(false);
    setNewCat("");
  };

  const cancelNewCategory = () => { setShowAddCat(false); setNewCat(""); };

  const askDeleteCategory = () => {
    const current = form.category;
    if (!current || current === "อื่น ๆ") {
      alert("หมวด 'อื่น ๆ' ใช้เป็นค่าเริ่มต้น จำเป็นสำหรับระบบ ลบไม่ได้");
      return;
    }
    setPendingCatDelete(current);
  };

  const confirmDeleteCategory = () => {
    if (!pendingCatDelete) return;
    const name = pendingCatDelete;
    setEntries((arr) =>
      arr.map((e) => (e.type === form.type && e.category === name ? { ...e, category: "อื่น ๆ" } : e))
    );
    setCategories((c) => {
      const next = { ...c };
      next[form.type] = (next[form.type] || []).filter((x) => x !== name);
      if (!next[form.type].includes("อื่น ๆ")) next[form.type].push("อื่น ๆ");
      return next;
    });
    setForm((f) => ({ ...f, category: f.category === name ? "อื่น ๆ" : f.category }));
    setPendingCatDelete(null);
  };

  const cancelDeleteCategory = () => setPendingCatDelete(null);

  const quickFilter = (mode) => {
    const now = new Date();
    if (mode === "today") {
      const t = todayStr();
      setFilters((f) => ({ ...f, from: t, to: t }));
    } else if (mode === "week") {
      setFilters((f) => ({ ...f, from: startOfWeek(now).toISOString().slice(0, 10), to: endOfWeek(now).toISOString().slice(0, 10) }));
    } else if (mode === "month") {
      setFilters((f) => ({ ...f, from: startOfMonth(now).toISOString().slice(0, 10), to: endOfMonth(now).toISOString().slice(0, 10) }));
    } else if (mode === "all") {
      setFilters((f) => ({ ...f, from: "", to: "" }));
    }
  };

  const exportCSV = () => {
    const header = ["id", "date", "type", "category", "note", "amount"].join(",");
    const rows = entries.map((e) => [e.id, e.date, e.type, e.category, quoteCSV(e.note), e.amount].join(","));
    downloadBlob(`income-expense-${todayStr()}.csv`, [header, ...rows].join("\n"), "text/csv");
  };

  const quoteCSV = (s = "") => '"' + String(s).replaceAll('"', '""') + '"';

  const importCSV = async (file) => {
    if (!file) return;
    const text = await file.text();
    const [headerLine, ...lines] = text.split(/\r?\n/).filter(Boolean);
    const cols = headerLine.split(",");
    const idx = (name) => cols.indexOf(name);
    const required = ["date", "type", "category", "amount"];
    for (const r of required) if (idx(r) === -1) return alert("ไฟล์ CSV ต้องมีคอลัมน์: " + required.join(", "));

    const parsed = lines.map((line) => {
      // naive CSV split respecting quotes
      const cells = [];
      let cur = ""; let inQ = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
          else inQ = !inQ;
        } else if (ch === "," && !inQ) {
          cells.push(cur); cur = "";
        } else cur += ch;
      }
      cells.push(cur);

      const get = (name) => cells[idx(name)] || "";
      const id = get("id") || crypto.randomUUID();
      const date = get("date");
      const type = get("type");
      const category = get("category") || "อื่น ๆ";
      const note = get("note") || "";
      const amount = Number(get("amount") || 0);
      return { id, date, type, category, note, amount };
    }).filter((r) => r.date && r.type && r.amount);

    if (!parsed.length) return alert("ไม่พบข้อมูลที่นำเข้าได้");
    setEntries((arr) => [...parsed, ...arr]);
    alert("นำเข้าเรียบร้อย: " + parsed.length + " รายการ");
  };

  const resetAll = () => {
    if (!confirm("รีเซ็ตข้อมูลทั้งหมด (ลบทุกอย่าง) ใช่ไหม?")) return;
    setEntries([]);
    setCategories(DEFAULT_CATEGORIES);
  };

  // ===== UI =====
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
          className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Wallet className="w-7 h-7" />
            <h1 className="text-2xl md:text-3xl font-bold">โปรแกรมบันทึกรายรับ-รายจ่าย</h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={exportCSV} className="inline-flex items-center gap-2 rounded-2xl px-3 py-2 bg-white shadow hover:shadow-md">
              <Download className="w-4 h-4" /> ส่งออก CSV
            </button>
            <label className="inline-flex items-center gap-2 rounded-2xl px-3 py-2 bg-white shadow hover:shadow-md cursor-pointer">
              <Upload className="w-4 h-4" /> นำเข้า CSV
              <input type="file" accept=".csv" className="hidden" onChange={(e) => importCSV(e.target.files?.[0])} />
            </label>
            <button onClick={resetAll} className="inline-flex items-center gap-2 rounded-2xl px-3 py-2 bg-white shadow text-rose-600 hover:shadow-md">
              <RefreshCcw className="w-4 h-4" /> รีเซ็ต
            </button>
          </div>
        </motion.div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <SummaryCard title="รายรับรวม" value={fmtMoney(totals.inc)} icon={<ArrowUpCircle className="w-5 h-5" />} />
          <SummaryCard title="รายจ่ายรวม" value={fmtMoney(totals.exp)} icon={<ArrowDownCircle className="w-5 h-5" />} />
          <SummaryCard title="คงเหลือสุทธิ" value={fmtMoney(totals.net)} highlight icon={<Wallet className="w-5 h-5" />} />
        </div>

        {/* Add Form */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="mt-6 bg-white rounded-2xl shadow p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">เพิ่มรายการ</h2>
            <div className="text-xs text-slate-500">ข้อมูลจะถูกเก็บไว้ในเบราว์เซอร์ของเครื่องนี้ (localStorage)</div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-2 flex gap-2">
              {(["expense", "income"]).map((t) => (
                <button key={t}
                  onClick={() => setForm((f) => ({ ...f, type: t }))}
                  className={`flex-1 rounded-xl px-3 py-2 border ${form.type === t ? (t === "income" ? "bg-emerald-50 border-emerald-300" : "bg-rose-50 border-rose-300") : "bg-white"}`}>
                  {t === "income" ? "รายรับ" : "รายจ่าย"}
                </button>
              ))}
            </div>
            <div className="md:col-span-2">
              <label className="text-xs text-slate-500">วันที่</label>
              <input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                className="w-full rounded-xl border px-3 py-2" />
            </div>
            <div className="md:col-span-3">
              <label className="text-xs text-slate-500">หมวดหมู่</label>
              <div className="flex gap-2">
                <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  className="flex-1 rounded-xl border px-3 py-2">
                  {(categories[form.type] || []).map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <button type="button" onClick={() => setShowAddCat((v)=>!v)} className="rounded-xl px-3 py-2 border bg-white hover:bg-slate-50">{showAddCat ? "ปิด" : "+ เพิ่ม"}</button>
                <button type="button" onClick={askDeleteCategory} className="rounded-xl px-3 py-2 border bg-white text-rose-600 hover:bg-rose-50">ลบหมวด</button>
              </div>
              {showAddCat && (
                <div className="flex gap-2 mt-2">
                  <input
                    value={newCat}
                    onChange={(e) => setNewCat(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") saveNewCategory(); }}
                    placeholder="ชื่อหมวดหมู่ใหม่"
                    className="flex-1 rounded-xl border px-3 py-2"
                  />
                  <button type="button" onClick={saveNewCategory} className="rounded-xl px-3 py-2 bg-indigo-600 text-white">บันทึก</button>
                  <button type="button" onClick={cancelNewCategory} className="rounded-xl px-3 py-2 border">ยกเลิก</button>
                </div>
              )}
            </div>
            <div className="md:col-span-3">
              <label className="text-xs text-slate-500">รายละเอียด</label>
              <input type="text" placeholder="เช่น กาแฟ, ค่าน้ำมัน, ขายของออนไลน์" value={form.note}
                onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                className="w-full rounded-xl border px-3 py-2" />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs text-slate-500">จำนวนเงิน (บาท)</label>
              <input ref={amountRef} type="number" min="0" step="0.01" value={form.amount}
                onKeyDown={(e) => { if (e.key === "Enter") editId ? saveEdit() : addEntry(); }}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                className="w-full rounded-xl border px-3 py-2" />
            </div>
            <div className="md:col-span-12 flex justify-end gap-2">
              {editId ? (
                <>
                  <button onClick={() => { setEditId(null); setForm((f) => ({ ...f, note: "", amount: "" })); }}
                    className="rounded-xl px-4 py-2 border">ยกเลิก</button>
                  <button onClick={saveEdit} className="inline-flex items-center gap-2 rounded-xl px-4 py-2 bg-emerald-600 text-white hover:bg-emerald-700">
                    <Plus className="w-4 h-4" /> บันทึกการแก้ไข
                  </button>
                </>
              ) : (
                <button onClick={addEntry} className="inline-flex items-center gap-2 rounded-xl px-4 py-2 bg-indigo-600 text-white hover:bg-indigo-700">
                  <Plus className="w-4 h-4" /> เพิ่มรายการ
                </button>
              )}
            </div>
          </div>
        </motion.div>

        {/* Filters */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="mt-4 bg-white rounded-2xl shadow p-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="w-4 h-4" />
            <h3 className="font-medium">ตัวกรอง</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-3">
              <label className="text-xs text-slate-500">ค้นหา</label>
              <div className="flex items-center gap-2 rounded-xl border px-3 py-2">
                <Search className="w-4 h-4" />
                <input className="flex-1 outline-none" placeholder="คำอธิบายหรือหมวดหมู่" value={filters.q}
                  onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))} />
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="text-xs text-slate-500">ประเภท</label>
              <select value={filters.type} onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))}
                className="w-full rounded-xl border px-3 py-2">
                <option value="all">ทั้งหมด</option>
                <option value="income">รายรับ</option>
                <option value="expense">รายจ่าย</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="text-xs text-slate-500">หมวดหมู่</label>
              <select value={filters.cat} onChange={(e) => setFilters((f) => ({ ...f, cat: e.target.value }))}
                className="w-full rounded-xl border px-3 py-2">
                <option value="all">ทั้งหมด</option>
                {Array.from(new Set(entries.map((e) => e.category))).map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="text-xs text-slate-500">จากวันที่</label>
              <input type="date" value={filters.from} onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
                className="w-full rounded-xl border px-3 py-2" />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs text-slate-500">ถึงวันที่</label>
              <input type="date" value={filters.to} onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
                className="w-full rounded-xl border px-3 py-2" />
            </div>
            <div className="md:col-span-12 flex flex-wrap gap-2">
              <QuickBtn onClick={() => quickFilter("today")}>วันนี้</QuickBtn>
              <QuickBtn onClick={() => quickFilter("week")}>สัปดาห์นี้</QuickBtn>
              <QuickBtn onClick={() => quickFilter("month")}>เดือนนี้</QuickBtn>
              <QuickBtn onClick={() => quickFilter("all")}>ทั้งหมด</QuickBtn>
            </div>
          </div>
        </motion.div>

        {/* Charts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div className="bg-white rounded-2xl shadow p-4">
            <div className="flex items-center gap-2 mb-2">
              <PieChartIcon className="w-4 h-4" />
              <h3 className="font-medium">สัดส่วนรายจ่ายตามหมวดหมู่ ({rangeLabel})</h3>
            </div>
            {pieSeries.length ? (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieSeries} dataKey="value" nameKey="name" outerRadius={110} label>
                      {pieSeries.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => fmtMoney(v)} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState text="ยังไม่มีข้อมูลรายจ่ายเดือนนี้" />
            )}
          </div>

          <div className="bg-white rounded-2xl shadow p-4">
            <div className="flex items-center gap-2 mb-2">
              <BarChartIcon className="w-4 h-4" />
              <h3 className="font-medium">รายรับ/รายจ่ายรายวัน ({rangeLabel})</h3>
            </div>
            {dailySeries.length ? (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailySeries}>
                    <XAxis dataKey="date" />
                    <YAxis tickFormatter={(v) => (Number(v) >= 1000 ? v / 1000 + "k" : v)} />
                    <Tooltip formatter={(v) => fmtMoney(v)} />
                    <Legend />
                    <Bar dataKey="รายรับ" fill="#059669" />
                    <Bar dataKey="รายจ่าย" fill="#dc2626" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState text="ยังไม่มีข้อมูลเดือนนี้" />
            )}
          </div>
        </div>

        {/* Table */}
        <div className="mt-4 bg-white rounded-2xl shadow overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b bg-slate-50">
            <h3 className="font-medium">รายการทั้งหมด ({filtered.length.toLocaleString()})</h3>
            <div className="text-sm text-slate-500">{rangeLabel}: รายรับ {fmtMoney(rangeTotals.inc)} · รายจ่าย {fmtMoney(rangeTotals.exp)} · สุทธิ {fmtMoney(rangeTotals.net)}</div>
          </div>
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <Th>วันที่</Th>
                  <Th>ประเภท</Th>
                  <Th>หมวดหมู่</Th>
                  <Th>รายละเอียด</Th>
                  <Th className="text-right">จำนวนเงิน</Th>
                  <Th className="text-right pr-4">จัดการ</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <tr key={e.id} className="border-b last:border-b-0 hover:bg-slate-50">
                    <Td>{e.date}</Td>
                    <Td>
                      <span className={`px-2 py-1 rounded-full text-xs ${e.type === "income" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                        {e.type === "income" ? "รายรับ" : "รายจ่าย"}
                      </span>
                    </Td>
                    <Td>{e.category}</Td>
                    <Td className="max-w-[28rem] truncate" title={e.note}>{e.note || <span className="text-slate-400">-</span>}</Td>
                    <Td className="text-right font-semibold">
                      <span className={e.type === "income" ? "text-emerald-700" : "text-rose-700"}>{fmtMoney(e.amount)}</span>
                    </Td>
                    <Td className="text-right pr-4">
                      <div className="inline-flex gap-2">
                        <button type="button" onClick={() => startEdit(e.id)} className="px-2 py-1 rounded-lg border hover:bg-white"><Edit className="w-4 h-4" /></button>
                        <button type="button" onClick={() => askDelete(e.id)} className="px-2 py-1 rounded-lg border hover:bg-white text-rose-600"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </Td>
                  </tr>
                ))}
                {!filtered.length && (
                  <tr>
                    <Td colSpan={6}>
                      <EmptyState text="ยังไม่มีรายการตามตัวกรองที่เลือก" />
                    </Td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        {pendingDelete && (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-white border shadow-lg rounded-xl px-4 py-3 z-50">
            <div className="flex items-center gap-3">
              <span className="text-sm">ลบรายการนี้แน่ไหม?</span>
              <button type="button" onClick={cancelDelete} className="px-3 py-1.5 rounded-lg border">ยกเลิก</button>
              <button type="button" onClick={confirmDelete} className="px-3 py-1.5 rounded-lg bg-rose-600 text-white">ลบเลย</button>
            </div>
          </div>
        )}

        {pendingCatDelete && (
          <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-white border shadow-lg rounded-xl px-4 py-3 z-50">
            <div className="flex items-center gap-3">
              <span className="text-sm">ลบหมวด "{pendingCatDelete}" ? รายการในหมวดนี้จะถูกย้ายไป "อื่น ๆ"</span>
              <button type="button" onClick={cancelDeleteCategory} className="px-3 py-1.5 rounded-lg border">ยกเลิก</button>
              <button type="button" onClick={confirmDeleteCategory} className="px-3 py-1.5 rounded-lg bg-rose-600 text-white">ลบหมวด</button>
            </div>
          </div>
        )}

        <footer className="text-center text-xs text-slate-400 mt-8">
          สร้างโดย ChatGPT · ข้อมูลเก็บเฉพาะในอุปกรณ์ของคุณ (ไม่อัปโหลดขึ้นเซิร์ฟเวอร์)
        </footer>
      </div>
    </div>
  );
}

function SummaryCard({ title, value, icon, highlight }) {
  return (
    <div className={`rounded-2xl p-4 bg-white shadow ${highlight ? "ring-1 ring-indigo-200" : ""}`}>
      <div className="flex items-center gap-2 text-slate-500 mb-1">{icon}<span className="text-sm">{title}</span></div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}

function QuickBtn({ children, onClick }) {
  return (
    <button onClick={onClick} className="rounded-full px-3 py-1.5 border bg-white hover:bg-slate-50 text-sm">
      {children}
    </button>
  );
}

function Th({ children, className = "" }) {
  return <th className={`text-left px-4 py-2 font-semibold text-slate-600 ${className}`}>{children}</th>;
}
function Td({ children, className = "", colSpan }) {
  return <td colSpan={colSpan} className={`px-4 py-2 ${className}`}>{children}</td>;
}

function EmptyState({ text }) {
  return (
    <div className="flex items-center justify-center h-40 text-slate-400">{text}</div>
  );
}
