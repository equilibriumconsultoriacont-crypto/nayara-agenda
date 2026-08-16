import { useState } from 'react';

const MONTHS_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

const COLORS = [
  '#22c55e','#16a34a','#84cc16','#eab308','#f59e0b','#f97316',
  '#ef4444','#f43f5e','#ec4899','#d946ef','#a855f7','#7c3aed',
  '#6366f1','#3b82f6','#0ea5e9','#06b6d4','#14b8a6','#64748b',
];
const EMOJIS = ['💼','🏥','🌙','😴','🏖️','🛌','🌞','🌴','✈️','🏠','❤️','⭐','🎉','☕','🚑','💊','🩺','📚','🎓','🏃'];

export default function ShiftModal({ date, shift, presets = [], onSave, onDelete, onClose }) {
  const [type, setType] = useState(shift?.type || 'work');
  const [startTime, setStartTime] = useState(shift?.start_time || '07:00');
  const [endTime, setEndTime] = useState(shift?.end_time || '13:00');
  const [hours, setHours] = useState(shift?.hours || 6);
  const [notes, setNotes] = useState(shift?.notes || '');
  const [color, setColor] = useState(shift?.color || '');
  const [emoji, setEmoji] = useState(shift?.emoji || '');
  const [saving, setSaving] = useState(false);

  const [y, m, d] = date.split('-');
  const dayOfWeek = new Date(date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long' });
  const label = `${d} de ${MONTHS_PT[Number(m)-1]}, ${y}`;

  // Horários padrões cadastrados pela pessoa (com cor/emoji). Se não tiver, usa uns genéricos.
  const myPresets = presets.length > 0
    ? presets.map(p => ({ label: p.label, type: p.type, start: p.start_time || '', end: p.end_time || '', hours: p.hours || 0, color: p.color || '', emoji: p.emoji || '' }))
    : [
        { label: '6h manhã', type: 'work', start: '07:00', end: '13:00', hours: 6, color: '', emoji: '' },
        { label: '6h tarde', type: 'work', start: '13:00', end: '19:00', hours: 6, color: '', emoji: '' },
        { label: '12h dia', type: 'plantao', start: '07:00', end: '19:00', hours: 12, color: '', emoji: '' },
        { label: '12h noite', type: 'plantao', start: '19:00', end: '07:00', hours: 12, color: '', emoji: '' },
        { label: 'Folga', type: 'off', start: '', end: '', hours: 0, color: '', emoji: '' },
      ];

  const applyPreset = (p) => {
    setType(p.type); setStartTime(p.start);
    setEndTime(p.end); setHours(p.hours); setColor(p.color || ''); setEmoji(p.emoji || '');
  };

  const handleSave = async () => {
    setSaving(true);
    await onSave(date, {
      type,
      startTime: type === 'off' ? null : startTime || null,
      endTime: type === 'off' ? null : endTime || null,
      hours: type === 'off' ? 0 : hours || null,
      notes: notes || null,
      color: color || null,
      emoji: emoji || null,
    });
    setSaving(false);
    onClose();
  };

  const handleDelete = async () => {
    if (!shift) { onClose(); return; }
    setSaving(true);
    await onDelete(date);
    setSaving(false);
    onClose();
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100, display: 'flex',
      alignItems: 'flex-end', justifyContent: 'center',
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        width: '100%', maxWidth: 500, borderRadius: '20px 20px 0 0',
        background: 'linear-gradient(180deg, #1e1035 0%, #15092e 100%)',
        border: '1px solid rgba(109,40,217,0.4)', borderBottom: 'none',
        padding: '20px 20px 40px', maxHeight: '90vh', overflowY: 'auto',
      }}>
        {/* Handle bar */}
        <div style={{ width: 40, height: 4, background: '#6d28d9', borderRadius: 2, margin: '0 auto 16px' }} />

        {/* Date header */}
        <div style={{ marginBottom: 20, textAlign: 'center' }}>
          <p style={{ fontSize: 18, fontWeight: 700, color: '#e2e8f0', textTransform: 'capitalize' }}>{dayOfWeek}</p>
          <p style={{ fontSize: 14, color: '#a78bfa' }}>{label}</p>
        </div>

        {/* Meus horários (presets) */}
        <p style={{ fontSize: 12, color: '#7c3aed', marginBottom: 8, fontWeight: 600 }}>MEUS HORÁRIOS</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 20 }}>
          {myPresets.map((p, i) => (
            <button key={p.label + i} onClick={() => applyPreset(p)} style={{
              padding: '10px 6px', borderRadius: 10, fontSize: 12, fontWeight: 600,
              background: 'rgba(109,40,217,0.12)',
              border: `1px solid ${p.color || 'rgba(109,40,217,0.3)'}`,
              borderLeft: `4px solid ${p.color || 'rgba(109,40,217,0.5)'}`,
              color: '#c4b5fd', textAlign: 'left',
            }}>
              {p.type === 'off' ? '🌙' : p.type === 'plantao' ? '🏥' : '💼'} {p.label}
            </button>
          ))}
        </div>

        {/* Type selector */}
        <p style={{ fontSize: 12, color: '#7c3aed', marginBottom: 8, fontWeight: 600 }}>TIPO</p>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {[
            { v: 'work', e: '💼', l: 'Trabalho' },
            { v: 'plantao', e: '🏥', l: 'Plantão' },
            { v: 'off', e: '🌙', l: 'Folga' },
          ].map(t => (
            <button key={t.v} onClick={() => setType(t.v)} style={{
              flex: 1, padding: '10px 6px', borderRadius: 10, fontSize: 12, fontWeight: 600,
              background: type === t.v ? 'rgba(109,40,217,0.5)' : 'rgba(109,40,217,0.1)',
              border: `1px solid ${type === t.v ? '#7c3aed' : 'rgba(109,40,217,0.2)'}`,
              color: type === t.v ? '#fff' : '#a78bfa',
            }}>
              {t.e} {t.l}
            </button>
          ))}
        </div>

        {/* Time fields */}
        {type !== 'off' && (
          <>
            <p style={{ fontSize: 12, color: '#7c3aed', marginBottom: 8, fontWeight: 600 }}>HORÁRIOS</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
              <div>
                <label style={{ fontSize: 11, color: '#7c3aed', display: 'block', marginBottom: 4 }}>Início</label>
                <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} style={{
                  width: '100%', padding: '10px 8px', borderRadius: 8, fontSize: 14,
                  background: 'rgba(109,40,217,0.15)', border: '1px solid rgba(109,40,217,0.3)',
                  color: '#e2e8f0', outline: 'none',
                }} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: '#7c3aed', display: 'block', marginBottom: 4 }}>Fim</label>
                <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} style={{
                  width: '100%', padding: '10px 8px', borderRadius: 8, fontSize: 14,
                  background: 'rgba(109,40,217,0.15)', border: '1px solid rgba(109,40,217,0.3)',
                  color: '#e2e8f0', outline: 'none',
                }} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: '#7c3aed', display: 'block', marginBottom: 4 }}>Horas</label>
                <select value={hours} onChange={e => setHours(Number(e.target.value))} style={{
                  width: '100%', padding: '10px 8px', borderRadius: 8, fontSize: 14,
                  background: 'rgba(109,40,217,0.15)', border: '1px solid rgba(109,40,217,0.3)',
                  color: '#e2e8f0', outline: 'none',
                }}>
                  {[4,6,8,10,12].map(h => <option key={h} value={h}>{h}h</option>)}
                </select>
              </div>
            </div>
          </>
        )}

        {/* Emoji (opcional) — vale para qualquer tipo, inclusive Folga */}
        <p style={{ fontSize: 12, color: '#7c3aed', marginBottom: 8, fontWeight: 600 }}>EMOJI (OPCIONAL)</p>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20, alignItems: 'center' }}>
          <button type="button" onClick={() => setEmoji('')} style={{
            padding: '6px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600,
            background: emoji ? 'rgba(109,40,217,0.1)' : 'rgba(109,40,217,0.4)',
            border: '1px solid rgba(109,40,217,0.3)', color: '#c4b5fd',
          }}>Padrão</button>
          {EMOJIS.map(e => (
            <button key={e} type="button" onClick={() => setEmoji(e)} style={{
              fontSize: 20, padding: 5, borderRadius: 8, lineHeight: 1, cursor: 'pointer',
              background: emoji === e ? 'rgba(109,40,217,0.45)' : 'rgba(109,40,217,0.1)',
              border: `1px solid ${emoji === e ? '#7c3aed' : 'rgba(109,40,217,0.2)'}`,
            }}>{e}</button>
          ))}
        </div>

        {/* Cor (opcional) — vale para qualquer tipo, inclusive Folga */}
        <p style={{ fontSize: 12, color: '#7c3aed', marginBottom: 8, fontWeight: 600 }}>COR (OPCIONAL)</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20, alignItems: 'center' }}>
          <button type="button" onClick={() => setColor('')} style={{
            padding: '6px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600,
            background: color ? 'rgba(109,40,217,0.1)' : 'rgba(109,40,217,0.4)',
            border: '1px solid rgba(109,40,217,0.3)', color: '#c4b5fd',
          }}>Padrão</button>
          {COLORS.map(c => (
            <button key={c} type="button" onClick={() => setColor(c)} style={{
              width: 30, height: 30, borderRadius: '50%', background: c, border: 'none', cursor: 'pointer',
              outline: color === c ? '3px solid #fff' : '3px solid transparent', outlineOffset: 2,
            }} />
          ))}
        </div>

        {/* Notes */}
        <p style={{ fontSize: 12, color: '#7c3aed', marginBottom: 8, fontWeight: 600 }}>OBSERVAÇÃO</p>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
          placeholder="Ex: Plantão no CTI, levar lanche..."
          style={{
            width: '100%', padding: '10px 12px', borderRadius: 10, fontSize: 14, resize: 'none',
            background: 'rgba(109,40,217,0.1)', border: '1px solid rgba(109,40,217,0.3)',
            color: '#e2e8f0', outline: 'none', marginBottom: 20,
          }} />

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8 }}>
          {shift && (
            <button onClick={handleDelete} disabled={saving} style={{
              padding: '13px 16px', borderRadius: 12, border: '1px solid rgba(239,68,68,0.3)',
              background: 'rgba(239,68,68,0.1)', color: '#f87171', fontSize: 20,
            }}>🗑️</button>
          )}
          <button onClick={onClose} style={{
            flex: 1, padding: '13px', borderRadius: 12,
            border: '1px solid rgba(109,40,217,0.3)', background: 'rgba(109,40,217,0.1)',
            color: '#a78bfa', fontSize: 15, fontWeight: 600,
          }}>Cancelar</button>
          <button onClick={handleSave} disabled={saving} style={{
            flex: 2, padding: '13px', borderRadius: 12, border: 'none',
            background: 'linear-gradient(135deg, #6d28d9, #a855f7)',
            color: '#fff', fontSize: 15, fontWeight: 700,
            boxShadow: '0 4px 15px rgba(109,40,217,0.4)',
          }}>
            {saving ? 'Salvando...' : shift ? '✅ Salvar' : '➕ Adicionar'}
          </button>
        </div>
      </div>
    </div>
  );
}
