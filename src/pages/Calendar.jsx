import { useState, useEffect, useCallback } from 'react';
import ShiftModal from '../components/ShiftModal.jsx';
import DayDetail from '../components/DayDetail.jsx';

const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const WEEKDAYS = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

const TYPE_CONFIG = {
  work:    { emoji: '💼', label: 'Trabalho',  bg: 'rgba(109,40,217,0.25)', border: 'rgba(109,40,217,0.6)', color: '#c4b5fd' },
  plantao: { emoji: '🏥', label: 'Plantão',   bg: 'rgba(16,185,129,0.2)',  border: 'rgba(16,185,129,0.5)', color: '#6ee7b7' },
  off:     { emoji: '🌙', label: 'Folga',     bg: 'rgba(251,191,36,0.15)', border: 'rgba(251,191,36,0.4)', color: '#fde68a' },
};

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return new Uint8Array([...rawData].map(c => c.charCodeAt(0)));
}

export default function Calendar({ user }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [shifts, setShifts] = useState({});
  const [tagsByDate, setTagsByDate] = useState({});
  const [selected, setSelected] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const loadShifts = useCallback(async () => {
    try {
      const r = await fetch(`/api/shifts/${year}/${month}`);
      const data = await r.json();
      const map = {};
      data.shifts.forEach(s => { map[s.date] = s; });
      setShifts(map);
      setTagsByDate(data.tagsByDate || {});
    } catch {}
  }, [year, month]);

  useEffect(() => { loadShifts(); }, [loadShifts]);

  useEffect(() => {
    setupPush();
  }, []);

  async function setupPush() {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return;
    let perm = Notification.permission;
    if (perm === 'default') perm = await Notification.requestPermission();
    if (perm !== 'granted') return;
    try {
      const r = await fetch('/api/push/vapid-key');
      const { publicKey } = await r.json();
      const sw = await navigator.serviceWorker.ready;
      const sub = await sw.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub),
      });
    } catch {}
  }

  const prevMonth = () => { if (month===1){setMonth(12);setYear(y=>y-1);}else setMonth(m=>m-1); };
  const nextMonth = () => { if (month===12){setMonth(1);setYear(y=>y+1);}else setMonth(m=>m+1); };

  const firstDay = new Date(year, month-1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells = [...Array(firstDay).fill(null), ...Array.from({length: daysInMonth},(_,i)=>i+1)];
  while (cells.length % 7 !== 0) cells.push(null);

  const todayStr = now.toISOString().slice(0,10);

  const handleDayClick = (day) => {
    if (!day) return;
    const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    setSelected(dateStr);
    setDetailOpen(true);
  };

  const shiftList = Object.values(shifts);
  const stats = {
    work: shiftList.filter(s=>s.type==='work').length,
    plantao: shiftList.filter(s=>s.type==='plantao').length,
    off: shiftList.filter(s=>s.type==='off').length,
    hours: shiftList.reduce((a,s)=>a+(s.hours||0),0),
  };

  return (
    <div style={{padding:'0 0 80px',maxWidth:500,margin:'0 auto'}}>
      {/* Navigator */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 16px 8px',gap:8}}>
        <button onClick={prevMonth} style={{background:'rgba(109,40,217,0.2)',border:'1px solid rgba(109,40,217,0.3)',color:'#c4b5fd',borderRadius:10,padding:'8px 14px',fontSize:18}}>‹</button>
        <div style={{textAlign:'center'}}>
          <p style={{fontSize:20,fontWeight:800,color:'#e2e8f0'}}>{MONTHS[month-1]}</p>
          <p style={{fontSize:13,color:'#a78bfa'}}>{year}</p>
        </div>
        <button onClick={nextMonth} style={{background:'rgba(109,40,217,0.2)',border:'1px solid rgba(109,40,217,0.3)',color:'#c4b5fd',borderRadius:10,padding:'8px 14px',fontSize:18}}>›</button>
      </div>

      {/* Stats */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,padding:'8px 16px 16px'}}>
        {[
          {label:'Trabalho',value:stats.work,emoji:'💼',color:'#c4b5fd'},
          {label:'Plantão',value:stats.plantao,emoji:'🏥',color:'#6ee7b7'},
          {label:'Folga',value:stats.off,emoji:'🌙',color:'#fde68a'},
          {label:'Horas',value:stats.hours+'h',emoji:'⏱️',color:'#93c5fd'},
        ].map(s=>(
          <div key={s.label} style={{background:'rgba(30,16,53,0.8)',borderRadius:12,padding:'10px 8px',textAlign:'center',border:'1px solid rgba(109,40,217,0.2)'}}>
            <p style={{fontSize:18,marginBottom:2}}>{s.emoji}</p>
            <p style={{fontSize:18,fontWeight:800,color:s.color}}>{s.value}</p>
            <p style={{fontSize:10,color:'#7c3aed'}}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Calendar */}
      <div style={{padding:'0 12px'}}>
        <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',marginBottom:4}}>
          {WEEKDAYS.map(d=>(
            <div key={d} style={{textAlign:'center',fontSize:11,color:'#7c3aed',fontWeight:600,padding:'4px 0'}}>{d}</div>
          ))}
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:3}}>
          {cells.map((day,idx)=>{
            if (!day) return <div key={idx}/>;
            const dateStr=`${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
            const shift=shifts[dateStr];
            const dayTags=tagsByDate[dateStr]||[];
            const isToday=dateStr===todayStr;
            const cfg=shift?TYPE_CONFIG[shift.type]:null;
            const isSun=idx%7===0, isSat=idx%7===6;
            return (
              <div key={idx} onClick={()=>handleDayClick(day)}
                style={{
                  borderRadius:10,padding:'5px 3px',minHeight:62,
                  background:cfg?cfg.bg:isToday?'rgba(109,40,217,0.15)':'rgba(30,16,53,0.5)',
                  border:`1px solid ${cfg?cfg.border:isToday?'rgba(109,40,217,0.5)':'rgba(109,40,217,0.1)'}`,
                  cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',gap:1,
                  boxShadow:isToday?'0 0 12px rgba(109,40,217,0.3)':'none',
                  transition:'transform 0.1s',
                }}
                onTouchStart={e=>e.currentTarget.style.transform='scale(0.95)'}
                onTouchEnd={e=>e.currentTarget.style.transform='scale(1)'}
              >
                <span style={{fontSize:12,fontWeight:isToday?800:500,color:isToday?'#a78bfa':isSun||isSat?'#f87171':cfg?cfg.color:'#94a3b8'}}>{day}</span>
                {cfg&&<span style={{fontSize:16}}>{cfg.emoji}</span>}
                {shift?.hours&&<span style={{fontSize:9,color:cfg?.color,fontWeight:600}}>{shift.hours}h</span>}
                {shift?.start_time&&<span style={{fontSize:8,color:'#94a3b8'}}>{shift.start_time}</span>}
                {dayTags.slice(0,2).map(t=>(
                  <span key={t.tag_id} style={{fontSize:11}}>{t.tag_emoji}</span>
                ))}
                {dayTags.length>2&&<span style={{fontSize:8,color:'#a78bfa'}}>+{dayTags.length-2}</span>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div style={{display:'flex',gap:12,justifyContent:'center',padding:'16px',flexWrap:'wrap'}}>
        {Object.entries(TYPE_CONFIG).map(([k,v])=>(
          <div key={k} style={{display:'flex',alignItems:'center',gap:4}}>
            <span style={{fontSize:14}}>{v.emoji}</span>
            <span style={{fontSize:11,color:v.color}}>{v.label}</span>
          </div>
        ))}
      </div>

      {/* Detail modal — for ALL users */}
      {detailOpen && selected && (
        <DayDetail
          date={selected}
          user={user}
          onClose={()=>setDetailOpen(false)}
          onEdit={()=>{setDetailOpen(false);setEditOpen(true);}}
          onRefresh={loadShifts}
        />
      )}

      {/* Edit modal — only for owner */}
      {editOpen && selected && (
        <ShiftModal
          date={selected}
          shift={shifts[selected]||null}
          existingTags={tagsByDate[selected]||[]}
          onSave={async(date,data)=>{
            await fetch(`/api/shifts/${date}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
            await loadShifts();
          }}
          onDelete={async(date)=>{
            await fetch(`/api/shifts/${date}`,{method:'DELETE'});
            await loadShifts();
          }}
          onClose={()=>setEditOpen(false)}
        />
      )}
    </div>
  );
}
