'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { formatCurrency, formatDate } from '@/lib/format';
import { toast } from '@/hooks/use-toast';
import { Plus, Search, Eye, Send, X, Trash2, FileText, ArrowRight, UserPlus, CreditCard, DollarSign, CircleCheck as CheckCircle } from 'lucide-react';
import type { Quotation, QuotationStatus, Customer, Product } from '@/lib/types';

const statusConfig: Record<QuotationStatus, { label: string; color: string; bg: string }> = {
  draft: { label: 'Draft', color: 'text-gray-600', bg: 'bg-gray-100' },
  sent: { label: 'Sent', color: 'text-blue-600', bg: 'bg-blue-100' },
  viewed: { label: 'Viewed', color: 'text-purple-600', bg: 'bg-purple-100' },
  accepted: { label: 'Accepted', color: 'text-green-600', bg: 'bg-green-100' },
  rejected: { label: 'Rejected', color: 'text-red-600', bg: 'bg-red-100' },
  expired: { label: 'Expired', color: 'text-orange-600', bg: 'bg-orange-100' },
  converted: { label: 'Converted', color: 'text-teal-600', bg: 'bg-teal-100' },
};

interface QuotationWithCustomer extends Omit<Quotation, 'customer'> {
  customer?: { name: string; code: string };
}

export default function QuotationsPage() {
  const [quotations, setQuotations] = useState<QuotationWithCustomer[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [viewingQuotation, setViewingQuotation] = useState<QuotationWithCustomer | null>(null);
  const [quotationItems, setQuotationItems] = useState<any[]>([]);
  const [convertingQuotation, setConvertingQuotation] = useState<QuotationWithCustomer | null>(null);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const [quoteRes, custRes, prodRes] = await Promise.all([
      supabase.from('quotations').select('*, customer:customers(name, code)').order('created_at', { ascending: false }),
      supabase.from('customers').select('*').eq('is_active', true).order('name'),
      supabase.from('products').select('*').eq('is_active', true).order('name'),
    ]);
    setQuotations(quoteRes.data || []);
    setCustomers(custRes.data || []);
    setProducts(prodRes.data || []);
    setLoading(false);
  }

  async function viewQuotationDetails(quotation: QuotationWithCustomer) {
    const { data } = await supabase
      .from('quotation_items')
      .select('*, product:products(name, sku, unit)')
      .eq('quotation_id', quotation.id);
    setQuotationItems(data || []);
    setViewingQuotation(quotation);
  }

  async function sendQuotation(quotation: QuotationWithCustomer) {
    const { error } = await supabase
      .from('quotations')
      .update({ status: 'sent' })
      .eq('id', quotation.id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Quotation marked as sent' });
      loadData();
    }
  }

  function initiateConvert(quotation: QuotationWithCustomer) {
    if (quotation.status === 'converted') {
      toast({ title: 'Error', description: 'Quotation already converted', variant: 'destructive' });
      return;
    }
    setViewingQuotation(null);
    setConvertingQuotation(quotation);
  }

  const filtered = quotations.filter(q =>
    (!search || q.quote_number.toLowerCase().includes(search.toLowerCase()) || q.customer?.name?.toLowerCase().includes(search.toLowerCase())) &&
    (!filterStatus || q.status === filterStatus)
  );

  const stats = {
    total: quotations.length,
    sent: quotations.filter(q => q.status === 'sent' || q.status === 'viewed').length,
    accepted: quotations.filter(q => q.status === 'accepted').length,
    totalValue: quotations.filter(q => q.status !== 'expired' && q.status !== 'rejected' && q.status !== 'converted').reduce((s, q) => s + Number(q.total_amount), 0),
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Quotations</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Create and manage price quotations</p>
        </div>
        <button onClick={() => setShowCreateModal(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition">
          <Plus className="w-4 h-4" />New Quotation
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Quotes', value: stats.total },
          { label: 'Awaiting Response', value: stats.sent },
          { label: 'Accepted', value: stats.accepted },
          { label: 'Pipeline Value', value: formatCurrency(stats.totalValue) },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="text-xl font-bold text-foreground mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-border p-4 shadow-sm flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search quotations..." className="w-full pl-8 pr-4 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="border border-border rounded-lg px-3 py-2 text-sm focus:outline-none">
          <option value="">All Status</option>
          {Object.entries(statusConfig).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      <div className="table-wrapper">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-muted/40 border-b border-border">
                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Quote #</th>
                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Customer</th>
                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Issue Date</th>
                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Expiry</th>
                <th className="text-right text-xs font-semibold text-muted-foreground px-4 py-3">Amount</th>
                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Status</th>
                <th className="text-right text-xs font-semibold text-muted-foreground px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: 7 }).map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-muted rounded animate-pulse" /></td>)}</tr>
              )) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground text-sm">No quotations found</td></tr>
              ) : filtered.map((q) => {
                const cfg = statusConfig[q.status as QuotationStatus] || statusConfig.draft;
                return (
                  <tr key={q.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3"><span className="text-sm font-semibold text-blue-600">{q.quote_number}</span></td>
                    <td className="px-4 py-3 text-sm text-foreground">{q.customer?.name || '-'}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{formatDate(q.issue_date)}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{q.expiry_date ? formatDate(q.expiry_date) : '-'}</td>
                    <td className="px-4 py-3 text-right text-sm font-semibold text-foreground">{formatCurrency(q.total_amount)}</td>
                    <td className="px-4 py-3"><span className={`badge-status ${cfg.bg} ${cfg.color}`}>{cfg.label}</span></td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => viewQuotationDetails(q)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-blue-50 text-muted-foreground hover:text-blue-600 transition"><Eye className="w-3.5 h-3.5" /></button>
                        {q.status === 'draft' && (
                          <button onClick={() => sendQuotation(q)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-green-50 text-muted-foreground hover:text-green-600 transition"><Send className="w-3.5 h-3.5" /></button>
                        )}
                        {q.status !== 'converted' && q.status !== 'rejected' && q.status !== 'expired' && (
                          <button onClick={() => initiateConvert(q)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-teal-50 text-muted-foreground hover:text-teal-600 transition" title="Convert to Invoice"><ArrowRight className="w-3.5 h-3.5" /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showCreateModal && (
        <CreateQuotationModal
          customers={customers}
          products={products}
          onClose={() => setShowCreateModal(false)}
          onSaved={() => { loadData(); }}
        />
      )}

      {viewingQuotation && (
        <ViewQuotationModal
          quotation={viewingQuotation}
          items={quotationItems}
          onClose={() => setViewingQuotation(null)}
          onConvert={() => initiateConvert(viewingQuotation)}
        />
      )}

      {convertingQuotation && (
        <ConvertToInvoiceModal
          quotation={convertingQuotation}
          onClose={() => setConvertingQuotation(null)}
          onConverted={() => { setConvertingQuotation(null); loadData(); }}
        />
      )}
    </div>
  );
}

function AddCustomerModal({ onClose, onSaved }: { onClose: () => void; onSaved: (id: string) => void }) {
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    type: 'retail' as 'retail' | 'contractor' | 'builder' | 'architect' | 'interior_designer' | 'corporate' | 'government',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setError('Customer name is required'); return; }
    setSaving(true);
    setError('');

    const code = `CUST-${Date.now().toString().slice(-6)}`;
    const { data, error: insertError } = await supabase
      .from('customers')
      .insert({
        code,
        name: form.name.trim(),
        phone: form.phone || null,
        email: form.email || null,
        address: form.address || null,
        type: form.type,
        country: 'Bangladesh',
        is_active: true,
        credit_limit: 0,
        credit_days: 0,
        outstanding_balance: 0,
        total_purchases: 0,
        loyalty_points: 0,
        discount_percent: 0,
      })
      .select('id')
      .single();

    if (insertError) { setError(insertError.message); setSaving(false); return; }

    toast({ title: 'Success', description: 'Customer added successfully' });
    onSaved(data.id);
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4" style={{ zIndex: 60 }}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-base font-bold flex items-center gap-2"><UserPlus className="w-4 h-4" />Add New Customer</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSave} className="p-4 space-y-3">
          {error && <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>}
          <div>
            <label className="block text-xs font-medium mb-1">Customer Name *</label>
            <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Enter customer name..." className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Phone</label>
              <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="Phone number..." className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Type</label>
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value as any })} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none">
                <option value="retail">Retail</option>
                <option value="contractor">Contractor</option>
                <option value="builder">Builder</option>
                <option value="architect">Architect</option>
                <option value="interior_designer">Interior Designer</option>
                <option value="corporate">Corporate</option>
                <option value="government">Government</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Email</label>
            <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="Email address..." className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Address</label>
            <textarea value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="Full address..." rows={2} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none" />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted transition">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition disabled:opacity-50">{saving ? 'Saving...' : 'Add Customer'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CreateQuotationModal({ customers: initialCustomers, products, onClose, onSaved }: {
  customers: Customer[];
  products: Product[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers);
  const [form, setForm] = useState({
    customer_id: '',
    issue_date: new Date().toISOString().split('T')[0],
    expiry_date: '',
    notes: '',
  });
  const [items, setItems] = useState<{ product_id: string; quantity: number; unit_price: number; discount_percent: number }[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showAddCustomer, setShowAddCustomer] = useState(false);

  function addItem() {
    setItems([...items, { product_id: '', quantity: 1, unit_price: 0, discount_percent: 0 }]);
  }

  function updateItem(index: number, field: string, value: any) {
    const updated = [...items];
    if (field === 'product_id') {
      const product = products.find(p => p.id === value);
      updated[index] = { product_id: value, quantity: 1, unit_price: product?.sale_price || 0, discount_percent: 0 };
    } else {
      (updated[index] as any)[field] = value;
    }
    setItems(updated);
  }

  function removeItem(index: number) {
    setItems(items.filter((_, i) => i !== index));
  }

  const subtotal = items.reduce((sum, item) => {
    const product = products.find(p => p.id === item.product_id);
    const price = item.unit_price || product?.sale_price || 0;
    const discount = (price * item.quantity * item.discount_percent) / 100;
    return sum + (item.quantity * price - discount);
  }, 0);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.customer_id) { setError('Please select a customer'); return; }
    if (items.length === 0) { setError('Please add at least one item'); return; }

    setSaving(true);
    setError('');

    const quoteNumber = `QT-${Date.now().toString().slice(-6)}`;

    const { data: quote, error: quoteError } = await supabase
      .from('quotations')
      .insert({
        quote_number: quoteNumber,
        customer_id: form.customer_id,
        issue_date: form.issue_date,
        expiry_date: form.expiry_date || null,
        subtotal,
        discount_amount: 0,
        tax_amount: 0,
        total_amount: subtotal,
        status: 'draft',
        notes: form.notes || null,
      })
      .select()
      .single();

    if (quoteError) { setError(quoteError.message); setSaving(false); return; }

    const quoteItems = items.map(item => {
      const product = products.find(p => p.id === item.product_id);
      const price = item.unit_price || product?.sale_price || 0;
      const discount = (price * item.quantity * item.discount_percent) / 100;
      return {
        quotation_id: quote.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: price,
        discount_percent: item.discount_percent,
        tax_rate: 0,
        subtotal: item.quantity * price - discount,
      };
    });

    const { error: itemsError } = await supabase.from('quotation_items').insert(quoteItems);
    if (itemsError) { setError(itemsError.message); setSaving(false); return; }

    toast({ title: 'Success', description: 'Quotation created successfully' });
    onSaved();
    onClose();
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-white z-10">
            <h2 className="text-base font-bold">Create Quotation</h2>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
          </div>
          <form onSubmit={handleSave} className="p-6 space-y-4">
            {error && <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>}

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1">Customer *</label>
                <div className="flex gap-1.5">
                  <select required value={form.customer_id} onChange={e => setForm({ ...form, customer_id: e.target.value })} className="flex-1 min-w-0 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none">
                    <option value="">Select customer</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowAddCustomer(true)}
                    title="Add new customer"
                    className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-lg border border-border hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 text-muted-foreground transition"
                  >
                    <UserPlus className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Issue Date</label>
                <input type="date" value={form.issue_date} onChange={e => setForm({ ...form, issue_date: e.target.value })} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Expiry Date</label>
                <input type="date" value={form.expiry_date} onChange={e => setForm({ ...form, expiry_date: e.target.value })} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium">Line Items</label>
                <button type="button" onClick={addItem} className="text-xs text-blue-600 hover:text-blue-700 font-medium">+ Add Item</button>
              </div>
              <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-muted/40">
                    <tr>
                      <th className="text-left text-xs font-semibold text-muted-foreground px-3 py-2">Product</th>
                      <th className="text-right text-xs font-semibold text-muted-foreground px-3 py-2 w-20">Qty</th>
                      <th className="text-right text-xs font-semibold text-muted-foreground px-3 py-2 w-28">Price</th>
                      <th className="text-right text-xs font-semibold text-muted-foreground px-3 py-2 w-20">Disc%</th>
                      <th className="text-right text-xs font-semibold text-muted-foreground px-3 py-2 w-28">Total</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {items.length === 0 ? (
                      <tr><td colSpan={6} className="px-3 py-4 text-center text-xs text-muted-foreground">No items added</td></tr>
                    ) : items.map((item, index) => (
                      <tr key={index}>
                        <td className="px-3 py-2">
                          <select value={item.product_id} onChange={e => updateItem(index, 'product_id', e.target.value)} className="w-full border border-border rounded px-2 py-1 text-sm focus:outline-none">
                            <option value="">Select product</option>
                            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <input type="number" min="1" value={item.quantity} onChange={e => updateItem(index, 'quantity', parseInt(e.target.value) || 1)} className="w-full border border-border rounded px-2 py-1 text-sm text-right focus:outline-none" />
                        </td>
                        <td className="px-3 py-2">
                          <input type="number" min="0" step="0.01" value={item.unit_price} onChange={e => updateItem(index, 'unit_price', parseFloat(e.target.value) || 0)} className="w-full border border-border rounded px-2 py-1 text-sm text-right focus:outline-none" />
                        </td>
                        <td className="px-3 py-2">
                          <input type="number" min="0" max="100" value={item.discount_percent} onChange={e => updateItem(index, 'discount_percent', parseFloat(e.target.value) || 0)} className="w-full border border-border rounded px-2 py-1 text-sm text-right focus:outline-none" />
                        </td>
                        <td className="px-3 py-2 text-right text-sm font-semibold">{formatCurrency(item.quantity * item.unit_price * (1 - item.discount_percent / 100))}</td>
                        <td className="px-2 py-2">
                          <button type="button" onClick={() => removeItem(index)} className="text-red-500 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end bg-muted/30 rounded-lg p-3">
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-lg font-bold text-foreground">{formatCurrency(subtotal)}</p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button type="button" onClick={onClose} className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-muted transition">Cancel</button>
              <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition disabled:opacity-60">
                {saving ? 'Creating...' : 'Create Quotation'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {showAddCustomer && (
        <AddCustomerModal
          onClose={() => setShowAddCustomer(false)}
          onSaved={(id) => {
            supabase.from('customers').select('*').eq('is_active', true).order('name').then(({ data }) => {
              if (data) setCustomers(data);
            });
            setForm(f => ({ ...f, customer_id: id }));
            setShowAddCustomer(false);
          }}
        />
      )}
    </>
  );
}

function ConvertToInvoiceModal({ quotation, onClose, onConverted }: {
  quotation: QuotationWithCustomer;
  onClose: () => void;
  onConverted: () => void;
}) {
  const [paymentMethods, setPaymentMethods] = useState<{ code: string; name: string }[]>([]);
  const [form, setForm] = useState({
    payment_type: 'credit' as 'credit' | 'partial' | 'full',
    payment_method: 'cash',
    amount_paid: 0,
    reference_number: '',
    notes: '',
    invoice_date: new Date().toISOString().split('T')[0],
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase.from('payment_methods').select('code, name').eq('is_active', true).order('sort_order')
      .then(({ data }) => { if (data) setPaymentMethods(data); });
  }, []);

  const totalAmount = Number(quotation.total_amount);

  const effectiveAmountPaid =
    form.payment_type === 'credit' ? 0 :
    form.payment_type === 'full' ? totalAmount :
    form.amount_paid;

  const balanceDue = totalAmount - effectiveAmountPaid;

  const invoiceStatus =
    form.payment_type === 'full' ? 'paid' :
    form.payment_type === 'partial' && effectiveAmountPaid > 0 ? 'partial' :
    'draft';

  async function handleConvert(e: React.FormEvent) {
    e.preventDefault();
    if (form.payment_type === 'partial' && (form.amount_paid <= 0 || form.amount_paid >= totalAmount)) {
      setError('Partial payment amount must be greater than 0 and less than the total amount');
      return;
    }

    setSaving(true);
    setError('');

    const { data: items } = await supabase
      .from('quotation_items')
      .select('*')
      .eq('quotation_id', quotation.id);

    const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;

    const { data: invoice, error: invError } = await supabase
      .from('invoices')
      .insert({
        invoice_number: invoiceNumber,
        customer_id: quotation.customer_id,
        quotation_id: quotation.id,
        invoice_date: form.invoice_date,
        subtotal: quotation.subtotal,
        discount_amount: quotation.discount_amount,
        tax_amount: quotation.tax_amount,
        total_amount: totalAmount,
        amount_paid: effectiveAmountPaid,
        balance_due: balanceDue,
        status: invoiceStatus,
        is_pos: false,
      })
      .select()
      .single();

    if (invError) { setError(invError.message); setSaving(false); return; }

    if (items && items.length > 0) {
      const invoiceItems = items.map((item: any) => ({
        invoice_id: invoice.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        discount_percent: item.discount_percent || 0,
        tax_rate: item.tax_rate || 0,
        subtotal: item.subtotal,
      }));
      await supabase.from('invoice_items').insert(invoiceItems);
    }

    if (effectiveAmountPaid > 0) {
      const paymentNumber = `PAY-${Date.now().toString().slice(-6)}`;
      await supabase.from('payments').insert({
        payment_number: paymentNumber,
        payment_type: 'received',
        reference_type: 'invoice',
        reference_id: invoice.id,
        customer_id: quotation.customer_id,
        amount: effectiveAmountPaid,
        payment_method: form.payment_method,
        payment_date: form.invoice_date,
        reference_number: form.reference_number || null,
        notes: form.notes || (form.payment_type === 'full' ? 'Full payment at invoice conversion' : 'Partial payment at invoice conversion'),
      });
    }

    const { data: customer } = await supabase
      .from('customers')
      .select('outstanding_balance, total_purchases')
      .eq('id', quotation.customer_id)
      .single();

    if (customer) {
      await supabase
        .from('customers')
        .update({
          outstanding_balance: (customer.outstanding_balance || 0) + balanceDue,
          total_purchases: (customer.total_purchases || 0) + totalAmount,
          updated_at: new Date().toISOString(),
        })
        .eq('id', quotation.customer_id);
    }

    await supabase.from('quotations').update({ status: 'converted' }).eq('id', quotation.id);

    toast({ title: 'Success', description: `Invoice ${invoiceNumber} created from quotation` });
    onConverted();
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-base font-bold">Convert to Invoice</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{quotation.quote_number} &rarr; {quotation.customer?.name}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleConvert} className="p-6 space-y-5">
          {error && <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>}

          <div className="bg-muted/30 rounded-lg p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Invoice Amount</p>
              <p className="text-2xl font-bold text-foreground">{formatCurrency(totalAmount)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Invoice Date</p>
              <input type="date" value={form.invoice_date} onChange={e => setForm({ ...form, invoice_date: e.target.value })} className="border border-border rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 mt-0.5" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-3">Payment Type *</label>
            <div className="grid grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setForm({ ...form, payment_type: 'credit', amount_paid: 0 })}
                className={`p-3 border rounded-lg text-center transition ${form.payment_type === 'credit' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-border hover:border-gray-300 text-foreground'}`}
              >
                <CreditCard className="w-5 h-5 mx-auto mb-1" />
                <p className="text-xs font-medium">Full Credit</p>
                <p className="text-[10px] text-muted-foreground">Pay later</p>
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, payment_type: 'partial', amount_paid: 0 })}
                className={`p-3 border rounded-lg text-center transition ${form.payment_type === 'partial' ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-border hover:border-gray-300 text-foreground'}`}
              >
                <DollarSign className="w-5 h-5 mx-auto mb-1" />
                <p className="text-xs font-medium">Partial</p>
                <p className="text-[10px] text-muted-foreground">Pay some now</p>
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, payment_type: 'full', amount_paid: totalAmount })}
                className={`p-3 border rounded-lg text-center transition ${form.payment_type === 'full' ? 'border-green-600 bg-green-50 text-green-700' : 'border-border hover:border-gray-300 text-foreground'}`}
              >
                <CheckCircle className="w-5 h-5 mx-auto mb-1" />
                <p className="text-xs font-medium">Full Payment</p>
                <p className="text-[10px] text-muted-foreground">Pay all now</p>
              </button>
            </div>
          </div>

          {form.payment_type !== 'credit' && (
            <div className="space-y-4 border border-border rounded-lg p-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1">Payment Method *</label>
                  <select value={form.payment_method} onChange={e => setForm({ ...form, payment_method: e.target.value })} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none">
                    {paymentMethods.length > 0
                      ? paymentMethods.map(m => <option key={m.code} value={m.code}>{m.name}</option>)
                      : <>
                          <option value="cash">Cash</option>
                          <option value="bank_transfer">Bank Transfer</option>
                          <option value="cheque">Cheque</option>
                          <option value="card">Card</option>
                          <option value="mobile_banking">Mobile Banking</option>
                        </>
                    }
                  </select>
                </div>
                {form.payment_type === 'partial' && (
                  <div>
                    <label className="block text-xs font-medium mb-1">Amount Paid *</label>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      max={totalAmount - 0.01}
                      value={form.amount_paid}
                      onChange={e => setForm({ ...form, amount_paid: parseFloat(e.target.value) || 0 })}
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Reference Number</label>
                <input value={form.reference_number} onChange={e => setForm({ ...form, reference_number: e.target.value })} placeholder="Cheque no., transaction ID..." className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Notes</label>
                <input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Optional payment notes..." className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
              </div>
            </div>
          )}

          <div className="bg-muted/30 rounded-lg p-3 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Amount</span>
              <span className="font-semibold">{formatCurrency(totalAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Amount Paid</span>
              <span className={`font-semibold ${effectiveAmountPaid > 0 ? 'text-green-600' : 'text-muted-foreground'}`}>{formatCurrency(effectiveAmountPaid)}</span>
            </div>
            <div className="flex justify-between border-t border-border pt-1.5">
              <span className="font-medium">Balance Due</span>
              <span className={`font-bold ${balanceDue > 0 ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(balanceDue)}</span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-muted transition">Cancel</button>
            <button type="submit" disabled={saving} className="flex items-center gap-2 px-5 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-semibold transition disabled:opacity-60">
              <FileText className="w-4 h-4" />
              {saving ? 'Converting...' : 'Convert to Invoice'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ViewQuotationModal({ quotation, items, onClose, onConvert }: {
  quotation: QuotationWithCustomer;
  items: any[];
  onClose: () => void;
  onConvert: () => void;
}) {
  const cfg = statusConfig[quotation.status as QuotationStatus] || statusConfig.draft;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-white">
          <h2 className="text-base font-bold">Quotation {quotation.quote_number}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Customer</p>
              <p className="font-semibold text-foreground">{quotation.customer?.name || '-'}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Status</p>
              <span className={`badge-status ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 py-3 border-y border-border">
            <div>
              <p className="text-xs text-muted-foreground">Issue Date</p>
              <p className="text-sm font-medium">{formatDate(quotation.issue_date)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Expiry Date</p>
              <p className="text-sm font-medium">{quotation.expiry_date ? formatDate(quotation.expiry_date) : '-'}</p>
            </div>
          </div>

          <div>
            <p className="text-xs font-medium mb-2">Items</p>
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="text-left text-xs font-semibold text-muted-foreground px-3 py-2">Product</th>
                    <th className="text-right text-xs font-semibold text-muted-foreground px-3 py-2">Qty</th>
                    <th className="text-right text-xs font-semibold text-muted-foreground px-3 py-2">Price</th>
                    <th className="text-right text-xs font-semibold text-muted-foreground px-3 py-2">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {items.length === 0 ? (
                    <tr><td colSpan={4} className="px-3 py-4 text-center text-xs text-muted-foreground">No items</td></tr>
                  ) : items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="px-3 py-2 text-sm">{item.product?.name || '-'}</td>
                      <td className="px-3 py-2 text-sm text-right">{item.quantity}</td>
                      <td className="px-3 py-2 text-sm text-right">{formatCurrency(item.unit_price)}</td>
                      <td className="px-3 py-2 text-sm text-right font-semibold">{formatCurrency(item.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end bg-muted/30 rounded-lg p-4">
            <div className="w-48">
              <div className="flex justify-between font-bold text-lg">
                <span>Total</span>
                <span className="text-blue-600">{formatCurrency(quotation.total_amount)}</span>
              </div>
            </div>
          </div>

          {quotation.status !== 'converted' && quotation.status !== 'rejected' && quotation.status !== 'expired' && (
            <button onClick={onConvert} className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-lg text-sm font-semibold transition">
              <FileText className="w-4 h-4" />Convert to Invoice
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
