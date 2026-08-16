import { useState, useEffect } from 'react';

const TYPES = [
  { v: 'work', e: '💼', l: 'Trabalho' },
  { v: 'plantao', e: '🏥', l: 'Plantão' },
  { v: 'off', e: '🌙', l: 'Folga' },
];
const COLORS = [
  '#22c55e','#16a34a','#84cc16','#eab308','#f59e0b','#f97316',
  '#ef4444','#f43f5e','#ec4899','#d946ef','#a855f7','#7c3aed',
  '#6366f1','#3b82f6','#0ea5e9','#06b6d4','#14b8a6','#64748b',
];
const EMOJIS = ['💼','🏥','🌙','😴','🏖️','🛌','🌞','🌴','✈️','🏠','❤️','⭐','🎉','☕','🚑','💊','🩺','📚','🎓','🏃'];

function calcHours(start, end) {
  if (!start || !end) return null;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let mins = (eh * 60 + em) - (sh * 60 + sm);
  if (mins <= 0) mins += 24 * 60;
  return Math.round(mins / 60);
}

const EMPTY = { label: '', type: 'work', start: '18:00', end: '00:00', color: '#22c55e', emoji: '' };

export default function Presets() {
  const [presets, setPresets] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    const r = await fetch('/api/presets');
    if (r.ok) setPresets(await r.json());
  };
  useEffect(() => { load(); }, []);

  const resetForm = () => { setForm(EMPTY); setEditingId(null); setError(''); };

  const startEdit = (p) => {
    setEditingId(p.id);
    setForm({
      label: p.label || '', type: p.type || 'work',
      start: p.start_time || '18:00', end: p.end_time || '00:00',
      color: p.color || '', emoji: p.emoji || '',
    });
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const submit = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const body = {
        label: form.label, type: form.type,
        startTime: form.type === 'off' ? null : form.start || null,
        endTime: form.type === 'off' ? null : form.end || null,
        hours: form.type === 'off' ? 0 : calcHours(form.start, form.end),
        color: form.color || null,
        emoji: form.emoji || null,
      };
      const url = editingId ? `/api/presets/${editingId}` : '/api/presets';
      const r = await fetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error || 'Erro'); return; }
      resetForm();
      await load();
    } finally { setLoading(false); }
  };

  const remove = async (id) => {
    if (!confirm('Remover este horário padrão?')) return;
    await fetch(`/api/presets/${id}`, { method: 'DELETE' });
    if (editingId === id) resetForm();
    load();
  };

  const field = {
    padding: '10px 12px', borderRadius: 8, fontSize: 14,
    background: 'rgba(109,40,217,0.1)', border: '1px solid rgba(109,40,217,0.3)',
    color: '#e2e8f0', outline: 'none',
  };
  const lbl = { fontSize: 12, color: '#7c3aed', display: 'block', marginBottom: 6 };

  return (
    <div style={{ padding: 16, maxWidth: 500, margin: '0 auto' }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: '#e2e8f0', marginBottom: 4 }}>⏰ Horários padrões</h2>
      <p style={{ fontSize: 13, color: '#a78bfa', marginBottom: 20 }}>
        Cadastre seus horários com cor e emoji. Ao tocar num dia, é só escolher — a cor e o emoji aparecem no calendário pra você identificar batendo o olho.
      </p>

      {presets.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          {presets.map(p => (
            <div key={p.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 14px', borderRadius: 12, marginBottom: 8,
              background: editingId === p.id ? 'rgba(109,40,217,0.25)' : 'rgba(30,16,53,0.8)',
              border: `1px solid ${(p.color || '#6d28d9')}55`, borderLeft: `4px solid ${p.color || '#6d28d9'}`,
            }}>
              <div>
                <p style={{ fontWeight: 600, color: '#e2e8f0', fontSize: 14 }}>
                  {p.emoji || TYPES.find(t => t.v === p.type)?.e} {p.label}
                </p>
                <p style={{ fontSize: 12, color: '#a78bfa', marginTop: 2 }}>
                  {p.type === 'off' ? 'Folga' : `${p.start_time || '?'} → ${p.end_time || '?'}${p.hours ? ` · ${p.hours}h` : ''}`}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => startEdit(p)} style={{
                  background: 'rgba(109,40,217,0.2)', border: '1px solid rgba(109,40,217,0.4)',
                  color: '#c4b5fd', borderRadius: 8, padding: '6px 10px', fontSize: 13, fontWeight: 600,
                }}>✏️ Editar</button>
                <button onClick={() => remove(p.id)} style={{
                  background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
                  color: '#f87171', borderRadius: 8, padding: '6px 10px', fontSize: 16,
                }}>🗑️</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{
        background: 'rgba(30,16,53,0.8)', borderRadius: 16,
        border: `1px solid ${editingId ? '#7c3aed' : 'rgba(109,40,217,0.3)'}`, padding: 20,
      }}>
        <p style={{ fontSize: 14, fontWeight: 700, color: '#c4b5fd', marginBottom: 16 }}>
          {editingId ? '✏️ Editar horário' : '➕ Novo horário padrão'}
        </p>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={lbl}>Nome *</label>
            <input value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} required
              placeholder="Ex.: Noturno, Plantão CTI..." style={{ ...field, width: '100%' }} />
          </div>

          <div>
            <label style={lbl}>Tipo</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {TYPES.map(t => (
                <button key={t.v} type="button" onClick={() => setForm({ ...form, type: t.v })} style={{
                  flex: 1, padding: '10px 6px', borderRadius: 10, fontSize: 12, fontWeight: 600,
                  background: form.type === t.v ? 'rgba(109,40,217,0.5)' : 'rgba(109,40,217,0.1)',
                  border: `1px solid ${form.type === t.v ? '#7c3aed' : 'rgba(109,40,217,0.2)'}`,
                  color: form.type === t.v ? '#fff' : '#a78bfa',
                }}>{t.e} {t.l}</button>
              ))}
            </div>
          </div>

          {form.type !== 'off' && (
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <label style={lbl}>Início</label>
                <input type="time" value={form.start} onChange={e => setForm({ ...form, start: e.target.value })} style={{ ...field, width: '100%' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={lbl}>Fim</label>
                <input type="time" value={form.end} onChange={e => setForm({ ...form, end: e.target.value })} style={{ ...field, width: '100%' }} />
              </div>
            </div>
          )}

          <div>
            <label style={lbl}>Emoji (opcional)</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button type="button" onClick={() => setForm({ ...form, emoji: '' })} style={{
                padding: '6px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                background: form.emoji ? 'rgba(109,40,217,0.1)' : 'rgba(109,40,217,0.4)',
                border: '1px solid rgba(109,40,217,0.3)', color: '#c4b5fd',
              }}>Padrão</button>
              {EMOJIS.map(e => (
                <button key={e} type="button" onClick={() => setForm({ ...form, emoji: e })} style={{
                  fontSize: 20, padding: 5, borderRadius: 8, lineHeight: 1, cursor: 'pointer',
                  background: form.emoji === e ? 'rgba(109,40,217,0.45)' : 'rgba(109,40,217,0.1)',
                  border: `1px solid ${form.emoji === e ? '#7c3aed' : 'rgba(109,40,217,0.2)'}`,
                }}>{e}</button>
              ))}
            </div>
          </div>

          <div>
            <label style={lbl}>Cor</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {COLORS.map(c => (
                <button key={c} type="button" onClick={() => setForm({ ...form, color: c })} style={{
                  width: 34, height: 34, borderRadius: '50%', background: c, border: 'none', cursor: 'pointer',
                  outline: form.color === c ? '3px solid #fff' : '3px solid transparent', outlineOffset: 2,
                }} />
              ))}
            </div>
          </div>

          {error && <p style={{ color: '#f87171', fontSize: 13 }}>❌ {error}</p>}

          <div style={{ display: 'flex', gap: 8 }}>
            {editingId && (
              <button type="button" onClick={resetForm} style={{
                flex: 1, padding: '12px', borderRadius: 10, border: '1px solid rgba(109,40,217,0.3)',
                background: 'rgba(109,40,217,0.1)', color: '#a78bfa', fontSize: 15, fontWeight: 600,
              }}>Cancelar</button>
            )}
            <button type="submit" disabled={loading} style={{
              flex: 2, padding: '12px', borderRadius: 10, border: 'none',
              background: 'linear-gradient(135deg,#6d28d9,#a855f7)', color: '#fff', fontSize: 15, fontWeight: 700,
            }}>{loading ? 'Salvando...' : editingId ? 'Salvar alterações' : 'Salvar horário'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
