import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

const API = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const labels = { dashboard: 'داشبورد', invoices: 'فاکتور فروش', customers: 'اشخاص', products: 'کالا و خدمات', settings: 'تنظیمات' };
const money = n => Number(n || 0).toLocaleString('fa-IR');
const today = () => new Date().toISOString().slice(0, 10);

async function api(path, options = {}) {
  const token = localStorage.getItem('token');
  let res;
  try {
    res = await fetch(API + path, { ...options, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers } });
  } catch { throw new Error('ارتباط با سرور برقرار نشد؛ آدرس API و اتصال اینترنت را بررسی کنید.'); }
  if (!res.ok) {
    let msg = '';
    try { const body = await res.json(); msg = body.message || body.title || ''; } catch {}
    if (res.status === 401) throw new Error('نشست معتبر نیست؛ دوباره وارد شوید.');
    throw new Error(msg || `خطای سرور (${res.status})`);
  }
  if (res.status === 204) return null;
  return (res.headers.get('content-type') || '').includes('application/json') ? res.json() : null;
}

function Login({ onLogin }) {
  const [mode, setMode] = useState('login'), [form, setForm] = useState({ companyName: '', fullName: '', username: '', password: '' }), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const change = k => e => setForm({ ...form, [k]: e.target.value });
  async function submit(e) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      if (mode === 'register') await api('/api/auth/register', { method: 'POST', body: JSON.stringify(form) });
      const r = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ username: form.username, password: form.password }) });
      localStorage.setItem('token', r.token); onLogin();
    } catch (err) { setError(err.message || 'ورود یا ثبت‌نام انجام نشد.'); } finally { setBusy(false); }
  }
  return <div className="auth-page"><form className="card auth-card" onSubmit={submit}><img className="brand-logo" src="/brand/logo-dark.png" alt="DAVIA"/><h1>داویا حساب</h1><p className="muted">سامانه حسابداری و مدیریت مالی</p>
    {mode === 'register' && <><label>نام شرکت<input required value={form.companyName} onChange={change('companyName')}/></label><label>نام مدیر<input required value={form.fullName} onChange={change('fullName')}/></label></>}
    <label>نام کاربری<input required autoComplete="username" value={form.username} onChange={change('username')}/></label><label>رمز عبور<input required minLength={6} type="password" value={form.password} onChange={change('password')}/></label>
    {error && <div className="error" role="alert">{error}</div>}<button className="primary" disabled={busy}>{busy ? 'لطفاً صبر کنید…' : mode === 'login' ? 'ورود' : 'ساخت حساب'}</button>
    <button type="button" className="link-button" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}>{mode === 'login' ? 'حساب ندارید؟ ثبت‌نام' : 'قبلاً حساب ساخته‌اید؟ ورود'}</button>
  </form></div>;
}

function App() {
  const [tab, setTab] = useState('dashboard'), [customers, setCustomers] = useState([]), [products, setProducts] = useState([]), [invoices, setInvoices] = useState([]), [loading, setLoading] = useState(true), [error, setError] = useState(''), [reloadKey, setReloadKey] = useState(0);
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true); setError('');
      try { const [c,p,i] = await Promise.all([api('/api/customers'), api('/api/products'), api('/api/invoices')]); if (alive) { setCustomers(c); setProducts(p); setInvoices(i); } }
      catch (e) { if (alive) { setError(e.message || 'دریافت اطلاعات ناموفق بود.'); if (/نشست معتبر نیست/.test(e.message || '')) localStorage.removeItem('token'); } }
      finally { if (alive) setLoading(false); }
    })(); return () => { alive = false; };
  }, [reloadKey]);
  const reload = () => setReloadKey(x => x + 1), logout = () => { localStorage.removeItem('token'); location.reload(); };
  return <div className="app-shell"><aside className="sidebar"><div className="sidebar-brand"><img src="/brand/logo-light.png" alt="DAVIA ACCOUNT"/></div><nav>{Object.keys(labels).map(k => <button key={k} className={tab === k ? 'active' : ''} onClick={() => { setTab(k); setError(''); }}>{labels[k]}</button>)}</nav><button className="logout" onClick={logout}>خروج</button></aside>
    <main className="main"><header className="topbar"><strong>{labels[tab]}</strong><span>DAVIA ACCOUNT</span></header>
      {error && <div className="notice error" role="alert"><span>{error}</span><button type="button" onClick={reload}>تلاش مجدد</button>{/نشست معتبر نیست/.test(error) && <button type="button" onClick={logout}>ورود مجدد</button>}</div>}
      {loading ? <div className="card empty">در حال بارگذاری…</div> : <>
        {tab === 'dashboard' && <><section className="grid"><Stat title="اشخاص" value={customers.length}/><Stat title="کالا و خدمات" value={products.length}/><Stat title="فاکتورهای فروش" value={invoices.length}/></section><div className="card quick-actions"><h3>شروع سریع</h3><button className="primary compact" onClick={() => setTab('customers')}>ثبت شخص جدید</button><button className="primary compact" onClick={() => setTab('products')}>ثبت کالا یا خدمت</button><button className="primary compact" onClick={() => setTab('invoices')}>صدور فاکتور</button></div></>}
        {tab === 'customers' && <Customers rows={customers} onSaved={reload}/>}{tab === 'products' && <Products rows={products} onSaved={reload}/>} {tab === 'invoices' && <Invoices rows={invoices} customers={customers} products={products} onSaved={reload}/>}
        {tab === 'settings' && <div className="card"><h3>تنظیمات</h3><p>مدیریت کاربران و نقش‌ها در مراحل بعدی توسعه تکمیل می‌شود.</p><p>آدرس API: <b dir="ltr">{API}</b></p></div>}
      </>}
    </main></div>;
}
function Stat({ title, value }) { return <div className="stat"><span>{title}</span><b>{money(value)}</b></div>; }
function Message({ text, success }) { return text ? <div className={success ? 'success' : 'error'} role="status">{text}</div> : null; }

function Customers({ rows, onSaved }) {
  const [f,setF] = useState({name:'',mobile:'',nationalId:''}), [q,setQ] = useState(''), [busy,setBusy] = useState(false), [msg,setMsg] = useState(''), [ok,setOk] = useState(false);
  const change = k => e => setF({...f,[k]:e.target.value});
  const filtered = rows.filter(x => [x.name,x.mobile,x.code,x.nationalId].some(v => String(v || '').toLowerCase().includes(q.toLowerCase())));
  async function submit(e) { e.preventDefault(); setBusy(true); setMsg(''); setOk(false); try { await api('/api/customers',{method:'POST',body:JSON.stringify({name:f.name.trim(),mobile:f.mobile||null,nationalId:f.nationalId||null})}); setF({name:'',mobile:'',nationalId:''}); setMsg('شخص با موفقیت ثبت شد.'); setOk(true); onSaved(); } catch(e) { setMsg(e.message || 'ثبت شخص ناموفق بود.'); } finally { setBusy(false); } }
  return <><form className="card data-form" onSubmit={submit}><h3>ثبت شخص جدید</h3><div className="form-grid"><label>نام شخص / شرکت *<input required value={f.name} onChange={change('name')}/></label><label>شماره موبایل<input inputMode="tel" value={f.mobile} onChange={change('mobile')}/></label><label>کد ملی / شناسه ملی<input value={f.nationalId} onChange={change('nationalId')}/></label></div><Message text={msg} success={ok}/><button className="primary compact" disabled={busy}>{busy?'در حال ثبت…':'ثبت شخص'}</button></form><List title="فهرست اشخاص" rows={filtered} cols={['code','name','mobile','nationalId']} query={q} setQuery={setQ}/></>;
}

function Products({ rows, onSaved }) {
  const [f,setF] = useState({code:'',name:'',barcode:'',salePrice:''}), [q,setQ] = useState(''), [busy,setBusy] = useState(false), [msg,setMsg] = useState(''), [ok,setOk] = useState(false);
  const change = k => e => setF({...f,[k]:e.target.value});
  const filtered = rows.filter(x => [x.name,x.code,x.barcode].some(v => String(v || '').toLowerCase().includes(q.toLowerCase())));
  async function submit(e) { e.preventDefault(); setBusy(true); setMsg(''); setOk(false); try { await api('/api/products',{method:'POST',body:JSON.stringify({code:f.code.trim()||null,name:f.name.trim(),barcode:f.barcode||null,salePrice:Number(f.salePrice)})}); setF({code:'',name:'',barcode:'',salePrice:''}); setMsg('کالا یا خدمت ثبت شد.'); setOk(true); onSaved(); } catch(e) { setMsg(e.message || 'ثبت کالا ناموفق بود.'); } finally { setBusy(false); } }
  return <><form className="card data-form" onSubmit={submit}><h3>ثبت کالا یا خدمت</h3><div className="form-grid"><label>نام کالا / خدمت *<input required value={f.name} onChange={change('name')}/></label><label>کد کالا<input value={f.code} onChange={change('code')} placeholder="اختیاری"/></label><label>بارکد<input value={f.barcode} onChange={change('barcode')}/></label><label>قیمت فروش (ریال) *<input required type="number" min="0" step="any" value={f.salePrice} onChange={change('salePrice')}/></label></div><Message text={msg} success={ok}/><button className="primary compact" disabled={busy}>{busy?'در حال ثبت…':'ثبت کالا / خدمت'}</button></form><List title="فهرست کالا و خدمات" rows={filtered} cols={['code','name','barcode','salePrice']} query={q} setQuery={setQ}/></>;
}

function Invoices({ rows, customers, products, onSaved }) {
  const line = () => ({productId:'',quantity:'1',unitPrice:'',description:''});
  const [f,setF] = useState({customerId:'',invoiceDate:today(),discount:'0',tax:'0',description:'',items:[line()]}), [busy,setBusy] = useState(false), [msg,setMsg] = useState(''), [ok,setOk] = useState(false);
  const change = k => e => setF({...f,[k]:e.target.value});
  const changeLine = (idx,k,v) => setF(s => ({...s,items:s.items.map((x,i) => { if(i!==idx)return x; if(k==='productId'){const p=products.find(p=>String(p.id)===v);return {...x,productId:v,unitPrice:p?String(p.salePrice??0):'',description:p?.name||''};}return {...x,[k]:v};})}));
  const subtotal = f.items.reduce((s,x)=>s+Math.max(0,Number(x.quantity)||0)*Math.max(0,Number(x.unitPrice)||0),0), total = subtotal-(Number(f.discount)||0)+(Number(f.tax)||0);
  async function submit(e) { e.preventDefault(); setBusy(true); setMsg(''); setOk(false); try {
    if(!f.items.length || f.items.some(x=>!x.productId || Number(x.quantity)<=0 || x.unitPrice==='' || Number(x.unitPrice)<0)) throw new Error('برای هر ردیف، کالا، تعداد مثبت و قیمت معتبر انتخاب کنید.');
    if(Number(f.discount)<0 || Number(f.tax)<0 || Number(f.discount)>subtotal) throw new Error('تخفیف یا مالیات معتبر نیست؛ تخفیف نباید از جمع اقلام بیشتر باشد.');
    const payload={customerId:f.customerId?Number(f.customerId):null,invoiceDate:f.invoiceDate?new Date(f.invoiceDate+'T12:00:00').toISOString():null,discount:Number(f.discount)||0,tax:Number(f.tax)||0,description:f.description||null,items:f.items.map(x=>({productId:Number(x.productId),quantity:Number(x.quantity),unitPrice:Number(x.unitPrice),description:x.description||null}))};
    await api('/api/invoices',{method:'POST',body:JSON.stringify(payload)}); setF({customerId:'',invoiceDate:today(),discount:'0',tax:'0',description:'',items:[line()]}); setMsg('فاکتور با موفقیت صادر شد.');setOk(true);onSaved();
  } catch(e) { setMsg(e.message||'صدور فاکتور ناموفق بود.'); } finally { setBusy(false); } }
  return <><form className="card data-form" onSubmit={submit}><h3>صدور فاکتور فروش</h3><div className="form-grid"><label>مشتری<select value={f.customerId} onChange={change('customerId')}><option value="">بدون انتخاب مشتری</option>{customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>تاریخ فاکتور<input required type="date" value={f.invoiceDate} onChange={change('invoiceDate')}/></label><label className="wide-field">شرح فاکتور<input value={f.description} onChange={change('description')}/></label></div>
    <div className="invoice-lines"><div className="section-heading"><h4>اقلام فاکتور</h4><button type="button" className="secondary compact" onClick={()=>setF(s=>({...s,items:[...s.items,line()]}))}>+ افزودن ردیف</button></div>
      {f.items.map((x,i)=><div className="invoice-line" key={i}><label>کالا / خدمت<select required value={x.productId} onChange={e=>changeLine(i,'productId',e.target.value)}><option value="">انتخاب کالا</option>{products.map(p=><option key={p.id} value={p.id}>{p.name} — {money(p.salePrice)}</option>)}</select></label><label>تعداد<input required type="number" min="0.001" step="any" value={x.quantity} onChange={e=>changeLine(i,'quantity',e.target.value)}/></label><label>قیمت واحد (ریال)<input required type="number" min="0" step="any" value={x.unitPrice} onChange={e=>changeLine(i,'unitPrice',e.target.value)}/></label><label>شرح ردیف<input value={x.description} onChange={e=>changeLine(i,'description',e.target.value)}/></label><div className="line-total">جمع ردیف: <b>{money((Number(x.quantity)||0)*(Number(x.unitPrice)||0))} ریال</b></div>{f.items.length>1&&<button type="button" className="remove-button" onClick={()=>setF(s=>({...s,items:s.items.filter((_,j)=>j!==i)}))}>حذف ردیف</button>}</div>)}
    </div><div className="form-grid totals-grid"><label>تخفیف (ریال)<input type="number" min="0" step="any" value={f.discount} onChange={change('discount')}/></label><label>مالیات / عوارض (ریال)<input type="number" min="0" step="any" value={f.tax} onChange={change('tax')}/></label><div className="invoice-total"><span>جمع اقلام: {money(subtotal)} ریال</span><strong>مبلغ نهایی: {money(total)} ریال</strong></div></div>
    <Message text={msg} success={ok}/><button className="primary compact" disabled={busy||products.length===0}>{busy?'در حال صدور…':'ثبت و صدور فاکتور'}</button>{products.length===0&&<p className="muted">برای صدور فاکتور، ابتدا یک کالا یا خدمت ثبت کنید.</p>}</form><List title="فاکتورهای ثبت‌شده" rows={rows} cols={['invoiceNumber','invoiceDate','customerName','status','total']}/></>;
}

function List({ title, rows, cols, query, setQuery }) {
  const names={code:'کد',name:'نام',mobile:'موبایل',nationalId:'کد ملی / شناسه ملی',barcode:'بارکد',salePrice:'قیمت فروش (ریال)',invoiceNumber:'شماره فاکتور',invoiceDate:'تاریخ',customerName:'مشتری',status:'وضعیت',total:'مبلغ نهایی (ریال)'};
  function value(r,c){if(c==='customerName')return r.customer?.name||r.customerName||'—';if(c==='invoiceDate'&&r[c]){const d=new Date(r[c]);return Number.isNaN(d.getTime())?r[c]:d.toLocaleDateString('fa-IR');}if(c==='salePrice'||c==='total')return money(r[c]);return r[c]??'—';}
  return <div className="card table-card"><div className="list-heading"><h3>{title} <small>({money(rows.length)})</small></h3>{setQuery&&<input className="search-input" value={query} onChange={e=>setQuery(e.target.value)} placeholder="جست‌وجو در فهرست…"/>}</div><div className="table-scroll"><table><thead><tr>{cols.map(c=><th key={c}>{names[c]||c}</th>)}</tr></thead><tbody>{rows.length===0?<tr><td colSpan={cols.length} className="no-rows">هنوز موردی ثبت نشده است.</td></tr>:rows.map((r,i)=><tr key={r.id??i}>{cols.map(c=><td key={c}>{value(r,c)}</td>)}</tr>)}</tbody></table></div></div>;
}
function Root(){const [logged,setLogged]=useState(!!localStorage.getItem('token'));return logged?<App/>:<Login onLogin={()=>setLogged(true)}/>;}
createRoot(document.getElementById('root')).render(<Root/>);
