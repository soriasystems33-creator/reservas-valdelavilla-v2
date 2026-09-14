'use client';
import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, ArrowRight, ArrowLeft, Home, Sun, Phone, Check, CheckCircle, Info, CloudSun } from 'lucide-react';

const MAX_PAX_ONLINE = 10;

export default function ReservasPage() {
  const [step, setStep] = useState(1);
  const [settings, setSettings] = useState({ shiftTemplates: [], defaultTemplateId: '', specialDays: {} });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [displayDate, setDisplayDate] = useState(new Date());

  // User selections
  const [uDate, setUDate] = useState(null);
  const [uMeal, setUMeal] = useState(null);
  const [uTime, setUTime] = useState(null);
  const [uZone, setUZone] = useState(null);
  const [uTotal, setUTotal] = useState(null);
  const [uAdults, setUAdults] = useState(null);
  const [uChildren, setUChildren] = useState(null);
  const [showChildrenInput, setShowChildrenInput] = useState(false);


  // Availability data
  const [slots, setSlots] = useState([]);
  const [zoneAvail, setZoneAvail] = useState(null);

  // Form data
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formAccepted, setFormAccepted] = useState(false);

  // Email popup
  const [showEmailPopup, setShowEmailPopup] = useState(false);
  const [popupEmail, setPopupEmail] = useState('');

  // Edit mode
  const [editId, setEditId] = useState(null);
  const [isExpired, setIsExpired] = useState(false);
  const [isCancelMode, setIsCancelMode] = useState(false);

  // Result
  const [bookingResult, setBookingResult] = useState(null);

  // Load settings and check for edit ID on mount
  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(settingsData => {
        setSettings(settingsData);
        setLoading(false);
        return settingsData;
      })
      .catch(() => { setLoading(false); return null; })
      .then(settingsData => {
        const params = new URLSearchParams(window.location.search);
        const id = params.get('id');
        const cancel = params.get('cancel');

        if (id) {
          setEditId(id);
          if (cancel === '1') setIsCancelMode(true);

          fetch(`/api/reserva?id=${id}`)
            .then(r => r.json())
            .then(data => {
              if (data.error) {
                setBookingResult({ error: data.error });
                return;
              }
              const s = settingsData || settings;
              const now = new Date();
              const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(now);
              const get = (t) => parseInt(parts.find(p => p.type === t)?.value || '0', 10);
              const todayStr = `${get('year')}-${String(get('month')).padStart(2,'0')}-${String(get('day')).padStart(2,'0')}`;
              const todaySpecial = s.specialDays && s.specialDays[todayStr];
              const lunchCutoff = '12:30';
              const dinnerCutoff = '20:00';
              const isDinner = data.time && parseInt(data.time.split(':')[0]) >= 17;
              const cutoffTime = isDinner ? dinnerCutoff : lunchCutoff;
              
              const [cutH, cutM] = cutoffTime.split(':').map(Number);
              if (data.date === todayStr && (get('hour') > cutH || (get('hour') === cutH && get('minute') >= cutM))) {
                setIsExpired(true);
                setBookingResult({ error: `La hora límite para gestionar reservas de hoy ha pasado (${cutoffTime}). Por favor, contacte por teléfono.` });
              }

              setFormName(data.clientName || data.name || '');
              setFormPhone(data.phone || '');
              setFormEmail(data.email || '');
              setFormNotes(data.notes || '');
              setUDate(data.date);
              setUTime(data.time);
              setUZone(data.zone);
              setUAdults(data.adults !== undefined ? data.adults : (data.pax || null));
              setUChildren(data.children !== undefined ? data.children : 0);
              
              fetch(`/api/availability?date=${data.date}`)
                .then(r => r.json())
                .then(availData => {
                  setSlots(availData.shifts || []);
                  setZoneAvail(availData.availability || {});
                });
            });
        } else if (cancel === '1') {
          setBookingResult({ error: 'Falta el ID de la reserva en el enlace. Por favor, revisa el email o contacta con nosotros.' });
        }
      });
  }, []);

  // ── Settings helpers ──
  const getShiftsForDate = useCallback((dateStr) => {
    const dObj = settings.specialDays && settings.specialDays[dateStr];
    let shifts = [];
    if (dObj) {
      if (dObj.type === 'closed') return [];
      if (dObj.type === 'custom' && dObj.shifts) shifts = dObj.shifts;
      else if (dObj.type === 'template' && dObj.templateIds) {
        dObj.templateIds.forEach(tid => {
          const tpl = (settings.shiftTemplates || []).find(t => t.id === tid);
          if (tpl && tpl.shifts) shifts = shifts.concat(tpl.shifts);
        });
      }
    }
    if (shifts.length === 0 && settings.defaultTemplateId) {
      const def = (settings.shiftTemplates || []).find(t => t.id === settings.defaultTemplateId);
      if (def && def.shifts) shifts = def.shifts;
    }
    if (dObj && (dObj.terrazaClosed || dObj.shiftOverrides)) {
      shifts = JSON.parse(JSON.stringify(shifts));
      var ovs = dObj.shiftOverrides || {};
      shifts = shifts.filter(s => !(ovs[s.time] && ovs[s.time].closed));
      shifts.forEach(s => {
        var so = ovs[s.time];
        if (dObj.terrazaClosed || (so && so.terrazaClosed === true)) s.capExterior = 0;
        if (so && so.terrazaClosed === false) s.capExterior = 100;
      });
    }
    return shifts;
  }, [settings]);

  const isDayClosed = useCallback((dateStr) => {
    const dObj = settings.specialDays && settings.specialDays[dateStr];
    return dObj && dObj.type === 'closed';
  }, [settings]);

  // ── Calendar ──
  const getLocalDateStr = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const calYear = displayDate.getFullYear();
  const calMonth = displayDate.getMonth();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const firstDow = (new Date(calYear, calMonth, 1).getDay() + 6) % 7;
  
  const todayObj = new Date();
  const todaySpain = new Date(todayObj.toLocaleString('en-US', { timeZone: 'Europe/Madrid' }));
  const todayStr = getLocalDateStr(todaySpain);
  
  const maxDateObj = new Date();
  maxDateObj.setMonth(todayObj.getMonth() + 2);
  const maxDateStr = getLocalDateStr(maxDateObj);

  const isNextMonthDisabled = calYear > maxDateObj.getFullYear() || (calYear === maxDateObj.getFullYear() && calMonth >= maxDateObj.getMonth());

  const monthNames = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const dayNames = ['L','M','X','J','V','S','D'];

  const selectDate = (dateStr) => {
    if (isDayClosed(dateStr)) return;
    setUDate(dateStr);
    setUTime(null);

    // Fetch availability for that date
    fetch(`/api/availability?date=${dateStr}`)
      .then(r => r.json())
      .then(data => {
        setSlots(data.shifts || []);
        // Build slot availability from the response
        setZoneAvail(data.availability || {});
      });
  };

  const selectTime = (time, isFull) => {
    if (isFull) return;
    setUTime(time);
    setUMeal(parseInt(time.split(':')[0], 10) >= 17 ? 'cena' : 'comida');
  };

  // ── Step navigation ──
  const goToStep = (s) => {
    if (s === 2) {
      setUZone(null);
      setUTotal(null);
      setUAdults(null);
      setUChildren(null);
      setShowChildrenInput(false);
    }
    setStep(s);
  };

  // ── Zone availability for step 2 ──
  const getZoneFree = (zone) => {
    if (!uTime || !zoneAvail || !zoneAvail[uTime]) return null;
    return zoneAvail[uTime][zone];
  };

  const maxPaxForZone = () => {
    if (!uZone || !uTime || !zoneAvail || !zoneAvail[uTime]) return 0;
    return zoneAvail[uTime][uZone]?.free || 0;
  };

  // ── Submit ──
  const doSubmit = async (emailOverride) => {
    const finalEmail = emailOverride !== undefined ? emailOverride : formEmail;
    setSubmitting(true);
    try {
      // Format times array if waitlist
      const timeToSend = uTime;

      const res = await fetch('/api/book', {
        method: editId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editId,
          name: formName, date: uDate, time: timeToSend,
          pax: uAdults + uChildren, adults: uAdults, children: uChildren, zone: uZone, meal: uMeal,
          phone: formPhone, email: finalEmail, notes: formNotes
        }),
      });
      const data = await res.json();
      if (data.success) {
        setBookingResult({ success: true, message: editId ? 'Reserva actualizada correctamente' : 'Reserva confirmada' });
        setStep(4);
      } else {
        setBookingResult({ error: data.error || 'Error al procesar la reserva' });
      }
    } catch {
      setBookingResult({ error: 'Error de conexión' });
    }
    setSubmitting(false);
  };

  const submitReservation = async (e) => {
    e.preventDefault();
    if (!formName || !uDate || !uTime || uTotal === null || !uZone) return;
    if (isExpired) return;
    if (!formEmail) {
      setPopupEmail('');
      setShowEmailPopup(true);
      return;
    }
    doSubmit(formEmail);
  };

  const cancelReservation = async () => {
    if (!editId || !window.confirm('¿Estás seguro de que quieres cancelar esta reserva?')) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/book?id=${editId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setBookingResult({ success: true, message: 'Reserva cancelada correctamente' });
        setStep(4);
      } else {
        setBookingResult({ error: data.error || 'Error al cancelar' });
      }
    } catch {
      setBookingResult({ error: 'Error de conexión' });
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-slate-300 border-t-[#3b526d] rounded-full spinner mx-auto mb-4"></div>
          <p className="text-slate-500 font-semibold">Cargando disponibilidad...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen py-6 px-4 max-w-2xl mx-auto">
      {/* Header */}
      <header className="text-center mb-8">
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-sm"></div>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Online</span>
        </div>
        <h1 className="text-3xl font-light text-slate-800 tracking-[0.2em] uppercase mb-1">Reserva tu Mesa</h1>
        <p className="text-slate-500 font-medium text-sm">Restaurante Valdelavilla — Reservas Online</p>
      </header>

      {/* Progress bar */}
      <div className="flex items-center justify-center gap-2 mb-8">
        {[1,2,3].map(s => (
          <div key={s} className={`h-1.5 rounded-full transition-all duration-300 ${s <= step ? 'bg-emerald-600 w-16' : 'bg-slate-200 w-8'}`}></div>
        ))}
      </div>

      {/* ═══ CANCEL MODE: Error (expired) ═══ */}
      {isCancelMode && bookingResult?.error && (
        <section className="step-container text-center animate-fade-in">
          <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-8 max-w-sm mx-auto">
            <p className="text-red-800 font-extrabold text-lg mb-2">No es posible cancelar online</p>
            <p className="text-red-700 text-sm font-medium mb-4">{bookingResult.error}</p>
            <a href="tel:000000000" className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-xl font-bold text-sm shadow-lg transition-colors">
              <Phone className="w-4 h-4" /> Llamar al restaurante
            </a>
          </div>
        </section>
      )}

      {/* ═══ CANCEL MODE: Confirmation Screen ═══ */}
      {isCancelMode && editId && !bookingResult?.success && !bookingResult?.error && (
        <section className="step-container text-center animate-fade-in">
            <h2 className="text-2xl font-light text-slate-800 mb-4 tracking-[0.15em] uppercase">¿Cancelar Reserva?</h2>
            <p className="text-slate-500 mb-6">Confirma los detalles de tu cita para proceder con la cancelación:</p>
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-8 text-left space-y-3">
               <p className="text-sm text-slate-600"><span className="font-bold text-slate-800">Fecha:</span> {uDate && new Date(uDate).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
               <p className="text-sm text-slate-600"><span className="font-bold text-slate-800">Hora:</span> {uTime}h</p>
               <p className="text-sm text-slate-600"><span className="font-bold text-slate-800">Nombre:</span> {formName}</p>
               <p className="text-sm text-slate-600"><span className="font-bold text-slate-800">Personas:</span> {uAdults + uChildren} ({uAdults} adulto{uAdults !== 1 ? 's' : ''} + {uChildren} niño{uChildren !== 1 ? 's' : ''})</p>
            </div>
            <p className="text-red-500 text-xs font-bold uppercase tracking-widest mb-8">Esta acción no se puede deshacer</p>
            <button
                disabled={submitting || isExpired}
                onClick={cancelReservation}
                className="w-full bg-red-600 hover:bg-red-700 disabled:bg-slate-300 text-white py-4 rounded-2xl font-bold uppercase tracking-widest text-sm shadow-lg transition-all"
            >
                {submitting ? 'Cancelando...' : 'Confirmar Cancelación'}
            </button>
            <button onClick={() => setIsCancelMode(false)} className="mt-6 text-slate-400 hover:text-slate-600 font-bold text-xs uppercase tracking-widest transition-colors block mx-auto">
                Prefiero Modificar mi Reserva
            </button>
        </section>
      )}

      {/* ═══ STEP 1: Date & Time ═══ */}
      {step === 1 && !isCancelMode && (
        <section className="step-container">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-light text-slate-800 mb-2 tracking-[0.15em] uppercase">¿Cuándo vienes?</h2>
            <p className="text-slate-500 font-medium">Elige fecha y turno</p>
          </div>

          {/* Calendar */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 mb-6">
            <div className="flex items-center justify-between mb-4">
              <button onClick={() => setDisplayDate(new Date(calYear, calMonth - 1, 1))} className="p-2 hover:bg-white rounded-lg transition-colors">
                <ChevronLeft className="w-5 h-5 text-slate-600" />
              </button>
              <h3 className="text-lg font-extrabold text-slate-800 uppercase tracking-wider">{monthNames[calMonth]} {calYear}</h3>
              <button disabled={isNextMonthDisabled} onClick={() => setDisplayDate(new Date(calYear, calMonth + 1, 1))} className={`p-2 rounded-lg transition-colors ${isNextMonthDisabled ? 'opacity-30 cursor-not-allowed' : 'hover:bg-white'}`}>
                <ChevronRight className="w-5 h-5 text-slate-600" />
              </button>
            </div>
            <div className="grid grid-cols-7 gap-1 mb-2">
              {dayNames.map(d => (
                <div key={d} className="text-center text-[10px] font-bold text-slate-400 uppercase py-1">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: firstDow }).map((_, i) => <div key={`e-${i}`} />)}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const ds = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const isPast = ds < todayStr;
                const isTooFar = ds > maxDateStr;
                const closed = isDayClosed(ds);
                const isSelected = ds === uDate;
                const isToday = ds === todayStr;
                const disabled = isPast || closed || isTooFar;
                return (
                  <button
                    key={day}
                    disabled={disabled}
                    onClick={() => !disabled && selectDate(ds)}
                    className={`cal-day aspect-square rounded-lg border text-sm font-bold flex items-center justify-center
                      ${isSelected ? 'cal-selected' : ''}
                      ${isToday && !isSelected ? 'cal-today border-emerald-600 text-emerald-700' : 'border-transparent'}
                      ${closed ? 'cal-closed' : ''}
                      ${(isPast || isTooFar) && !closed ? 'cal-disabled' : ''}
                      ${!disabled && !isSelected && !isToday ? 'text-slate-700 hover:bg-[#e2e8f0]' : ''}
                    `}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Time slots / Full day */}
          {uDate && !uMeal && (() => {
            const allFull = slots.length > 0 && zoneAvail && Object.values(zoneAvail).every(a => a.totalFree <= 0);
            if (allFull) {
              return (
                <div className="text-center py-8 px-4 mb-6">
                  <div className="bg-white border-2 border-slate-200 shadow-sm rounded-2xl p-6 max-w-sm mx-auto">
                    <p className="text-slate-800 font-bold text-lg mb-2">Completo</p>
                    <p className="text-slate-500 text-sm font-medium mb-4">No disponible para este día. Si necesitas ayuda, llámanos.</p>
                    <a href="tel:000000000" className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-xl font-bold text-sm shadow-lg transition-colors">
                      <Phone className="w-4 h-4" /> Llamar al restaurante
                    </a>
                  </div>
                </div>
              );
            }
            return (
              <div className="flex flex-row gap-4 justify-center items-stretch mb-6 max-w-sm mx-auto">
                 <button onClick={() => setUMeal('comida')} className="flex-1 px-2 py-8 rounded-2xl border-2 border-slate-200 bg-white hover:border-emerald-600 hover:bg-[#e2e8f0] text-slate-700 font-bold text-lg flex flex-col items-center justify-center gap-3 transition-all shadow-sm">
                    <Sun className="w-10 h-10 text-orange-500" />
                    COMIDA
                 </button>
                 <button onClick={() => setUMeal('cena')} className="flex-1 px-2 py-8 rounded-2xl border-2 border-slate-200 bg-white hover:border-emerald-600 hover:bg-[#e2e8f0] text-slate-700 font-bold text-lg flex flex-col items-center justify-center gap-3 transition-all shadow-sm">
                    <CloudSun className="w-10 h-10 text-indigo-500" />
                    CENA
                 </button>
              </div>
            );
          })()}

          {uDate && uMeal && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                 <button onClick={() => { setUMeal(null); setUTime(null); }} className="text-slate-500 hover:text-slate-800 font-bold text-sm flex items-center gap-1">
                    <ArrowLeft className="w-4 h-4" /> Volver
                 </button>
                 <span className="font-bold text-slate-700 uppercase tracking-widest text-xs bg-white px-3 py-1 rounded-full">{uMeal === 'comida' ? 'Comida' : 'Cena'}</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3" id="slots-container">
              {(() => {
                // Get current time in Spain timezone
                const nowParts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date());
                const getP = (t) => parseInt(nowParts.find(p => p.type === t)?.value || '0', 10);
                const nowH = getP('hour');
                const nowM = getP('minute');
                const todayStrCheck = `${getP('year')}-${String(getP('month')).padStart(2,'0')}-${String(getP('day')).padStart(2,'0')}`;
                const isToday = uDate === todayStrCheck;

                // Cutoff check: comidas → 12:30, cenas → 20:00
                const lunchCutoffH = 12, lunchCutoffM = 30;
                const dinnerCutoffH = 20, dinnerCutoffM = 0;
                const isPastLunchCutoff = isToday && (nowH > lunchCutoffH || (nowH === lunchCutoffH && nowM >= lunchCutoffM));
                const isPastDinnerCutoff = isToday && (nowH > dinnerCutoffH || (nowH === dinnerCutoffH && nowM >= dinnerCutoffM));

                // If today and past the cutoff for the selected meal, block entirely
                if ((uMeal === 'comida' && isPastLunchCutoff) || (uMeal === 'cena' && isPastDinnerCutoff)) {
                  return (
                    <div className="col-span-full text-center py-8 px-4">
                      <div className="bg-white border-2 border-slate-200 shadow-sm rounded-2xl p-6 max-w-sm mx-auto">
                        <p className="text-slate-800 font-bold text-lg mb-2">Reservas cerradas para hoy</p>
                        <p className="text-slate-500 text-sm font-medium mb-4">
                          La hora límite para reservar {uMeal === 'comida' ? 'comida' : 'cena'} de hoy ({uMeal === 'comida' ? '12:30' : '20:00'}) ya ha pasado. Para reservar, llámanos.
                        </p>
                        <a href="tel:000000000" className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-xl font-bold text-sm shadow-lg transition-colors">
                          <Phone className="w-4 h-4" /> Llamar al restaurante
                        </a>
                      </div>
                    </div>
                  );
                }

                const filteredSlots = slots.filter(s => {
                  const h = parseInt(s.time.split(':')[0], 10);
                  if (uMeal === 'comida') return h < 17;
                  if (uMeal === 'cena') return h >= 17;
                  return true;
                }).filter(s => {
                  // For today, also filter out individual slots whose time has already passed
                  if (!isToday) return true;
                  const [slotH, slotM] = s.time.split(':').map(Number);
                  return slotH > nowH || (slotH === nowH && slotM > nowM);
                });
                
                if (filteredSlots.length === 0) {
                  return (
                    <div className="col-span-full text-center py-8 px-4">
                      <div className="bg-white border-2 border-slate-200 shadow-sm rounded-2xl p-6 max-w-sm mx-auto">
                        <p className="text-slate-800 font-bold text-lg mb-2">Cerrado</p>
                        <p className="text-slate-500 text-sm font-medium mb-4">Hoy no hay turno de {uMeal}.</p>
                        <a href="tel:000000000" className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-xl font-bold text-sm shadow-lg transition-colors">
                          <Phone className="w-4 h-4" /> Llamar al restaurante
                        </a>
                      </div>
                    </div>
                  );
                }
                
                return filteredSlots.map(s => {
                  const avail = zoneAvail && zoneAvail[s.time];
                  const totalFree = avail ? avail.totalFree : 0;
                  const isFull = totalFree <= 0;
                  return (
                    <button
                      key={s.time}
                      onClick={() => selectTime(s.time, isFull)} disabled={isFull}
                      className={`slot-btn py-4 px-3 border-2 rounded-xl font-bold text-sm flex flex-col items-center gap-1 transition-all ${isFull ? 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed' : (!isFull && uTime === s.time ? 'border-emerald-600 bg-emerald-50 text-emerald-700 selected shadow-sm' : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-600')}`}
                    >
                      <span className="font-mono text-lg">{s.time}</span>
                      {isFull && <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Completo</span>}
                    </button>
                  );
                });
              })()}
              </div>
            </div>
          )}

          <div className="flex justify-center mt-8 mb-8">
            <button
              disabled={!uDate || !uTime}
              onClick={() => goToStep(2)}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:text-slate-500 text-white px-10 py-4 rounded-2xl font-bold uppercase tracking-widest text-sm shadow-lg transition-all flex items-center gap-2"
            >
              Siguiente Paso <ArrowRight className="w-5 h-5" />
            </button>
          </div>

          <div className="flex justify-center flex-col items-center gap-2 text-center mb-8">
            <h2 className="text-2xl font-light text-slate-800 mb-2 tracking-[0.15em] uppercase">¿Cuántos seréis y dónde?</h2>
            <p className="text-slate-500 font-medium">Reserva para el <span className="font-bold text-emerald-700">{uDate && new Date(uDate).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}</span> a las <span className="font-bold text-emerald-700">{uTime}</span>. Máximo 10 online.</p>
          </div>

          {/* Zone buttons with availability */}
          <div className="flex justify-center gap-4 mb-6">
            {['interior', 'exterior'].map(zone => {
              const avail = getZoneFree(zone);
              const label = zone === 'interior' ? 'Interior' : 'Terraza';
              const icon = zone === 'interior' ? 'home' : 'sun';
              const isSelected = uZone === zone;
              const noCapacity = avail && avail.free <= 0;
              return (
                <button
                  key={zone}
                  onClick={() => { if (noCapacity) return; setUZone(zone); setUAdults(null); setUChildren(null); }}
                  className={`flex-1 max-w-[180px] py-3 rounded-xl border-2 font-bold transition-all flex flex-col items-center gap-1
                    ${isSelected ? (noCapacity ? 'border-slate-300 bg-slate-100 text-slate-400' : 'border-emerald-600 bg-[#e2e8f0] text-emerald-700') : ''}
                    ${noCapacity && !isSelected ? 'border-slate-200 text-slate-400 bg-slate-50 hover:border-slate-300' : 'border-slate-200 text-slate-600 bg-white hover:border-emerald-600'}
                  `}
                >
                  {zone === 'interior' ? <Home className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                  {label}
                  {noCapacity && <span className="text-[9px] font-bold opacity-80 uppercase">Lista Espera</span>}
                </button>
              );
            })}
          </div>

          {/* Terrace Info & Weather */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center mb-8 max-w-lg mx-auto">
            <div className="bg-[#e2e8f0]/50 border border-slate-200 rounded-xl p-3 flex-1 flex items-start gap-2.5">
              <Info className="w-4 h-4 text-emerald-700 mt-0.5 shrink-0" />
              <p className="text-[11px] text-slate-600 font-medium leading-relaxed text-left">
                Nuestra terraza está <span className="font-bold text-slate-700">totalmente cubierta y aclimatada</span>, ofreciendo sombra en verano y resguardo si llueve.
              </p>
            </div>
            
            <a 
              href="YOUR_WEATHER_URL" 
              target="_blank" 
              rel="noopener noreferrer"
              className="bg-slate-50 hover:bg-white border border-slate-200 rounded-xl p-3 flex items-center justify-center gap-2 transition-colors sm:max-w-[140px] w-full group"
            >
              <CloudSun className="w-5 h-5 text-slate-500 group-hover:text-emerald-700 transition-colors" />
              <span className="text-[11px] font-bold text-slate-600 group-hover:text-emerald-700">Ver el Tiempo</span>
            </a>
          </div>

          {/* Guests selection */}
          {!uZone ? (
            <p className="text-slate-400 text-sm py-4 italic w-full text-center">Selecciona primero la zona (Interior o Terraza).</p>
          ) : (
            <>
              <p className="text-sm font-bold text-slate-700 mb-3 text-center">¿Cuántos comensales?</p>
              <div className="flex flex-wrap justify-center gap-3 md:gap-4 max-w-xl mx-auto mb-6">
                {Array.from({ length: MAX_PAX_ONLINE }).map((_, i) => {
                  const val = i + 1;
                  const maxAvail = Math.min(MAX_PAX_ONLINE, maxPaxForZone());
                  const available = val <= maxAvail;
                  return (
                    <button
                      key={val}
                      disabled={!available}
                      onClick={() => { setUTotal(val); setUChildren(0); setUAdults(val); setShowChildrenInput(false); }}
                      className={`w-14 h-14 md:w-16 md:h-16 border-2 rounded-2xl text-xl font-extrabold flex items-center justify-center transition-all pax-btn
                        ${uTotal === val ? 'selected' : ''}
                        ${available && uTotal !== val ? 'border-slate-200 text-slate-700 bg-white hover:border-emerald-600 hover:text-emerald-700' : ''}
                        ${!available ? 'border-slate-100 text-slate-300 bg-slate-50 cursor-not-allowed' : ''}
                      `}
                    >
                      {val}
                    </button>
                  );
                })}
                <button
                  onClick={() => window.location.href = 'tel:000000000'}
                  className="px-6 h-14 md:h-16 border-2 border-slate-200 rounded-2xl text-sm font-bold text-slate-500 bg-white shadow-sm flex items-center justify-center transition-all hover:border-slate-300"
                >
                  +10 <Phone className="w-4 h-4 ml-2" />
                </button>
              </div>

              {uTotal !== null && (
                <>
                  {/* Children toggle */}
                  <div className="flex justify-center mb-6">
                    <button
                      onClick={() => { if (showChildrenInput) { setUChildren(0); setUAdults(uTotal); } setShowChildrenInput(!showChildrenInput); }}
                      className={`flex items-center gap-2 px-5 py-2.5 rounded-xl border-2 text-sm font-bold transition-all
                        ${showChildrenInput
                          ? 'border-sky-300 bg-sky-50 text-sky-700'
                          : 'border-slate-200 bg-white text-slate-500 hover:border-sky-300 hover:text-sky-600'}
                      `}
                    >
                      {showChildrenInput ? '✓ ' : ''}
                      {showChildrenInput ? 'Quitar menú infantil' : '¿Necesitas menú infantil o trona?'}
                    </button>
                  </div>

                  {showChildrenInput && (
                    <>
                      <p className="text-sm font-bold text-slate-700 mb-1 text-center">¿Cuántos son niños?</p>
                      <p className="text-xs text-slate-500 font-semibold mb-3 text-center max-w-sm mx-auto leading-relaxed">
                        (Dentro del total de comensales ya seleccionados. Menores de 14 años)
                      </p>
                      <div className="flex flex-wrap justify-center gap-3 md:gap-4 max-w-xl mx-auto mb-4">
                        {Array.from({ length: uTotal + 1 }).map((_, i) => {
                          const val = i;
                          return (
                            <button
                              key={val}
                              onClick={() => { setUChildren(val); setUAdults(uTotal - val); }}
                              className={`w-14 h-14 md:w-16 md:h-16 border-2 rounded-2xl text-xl font-extrabold flex items-center justify-center transition-all pax-btn
                                ${uChildren === val ? 'selected' : ''}
                                border-slate-200 text-slate-700 bg-white hover:border-emerald-600 hover:text-emerald-700
                              `}
                            >
                              {val}
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}

                  <p className="text-center text-sm font-bold text-emerald-700 mb-2">
                    Total: {uTotal} ({uAdults} adulto{uAdults !== 1 ? 's' : ''}{uChildren > 0 ? ` + ${uChildren} niño${uChildren !== 1 ? 's' : ''}` : ''})
                  </p>
                </>
              )}
            </>
          )}

          <div className="flex justify-center mt-8">
            <button
              disabled={uTotal === null}
              onClick={() => goToStep(3)}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:text-slate-500 text-white px-10 py-4 rounded-2xl font-bold uppercase tracking-widest text-sm shadow-lg transition-all flex items-center gap-2"
            >
              Continuar a Datos <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </section>
      )}

      {/* ═══ STEP 3: Personal Data ═══ */}
      {step === 3 && !isCancelMode && (
        <section className="step-container">
          <button onClick={() => goToStep(2)} className="mb-6 flex items-center gap-2 text-slate-500 hover:text-slate-800 font-bold text-sm">
            <ArrowLeft className="w-4 h-4" /> Volver
          </button>
          
          

          <div className="text-center mb-8">
            <h2 className="text-2xl font-light text-slate-800 mb-2 tracking-[0.15em] uppercase">Tus Datos</h2>
            <p className="text-slate-500 font-medium">
              <span className="font-bold text-emerald-700">{uTotal}</span> ({uAdults} adulto{uAdults !== 1 ? 's' : ''}{uChildren > 0 ? ` + ${uChildren} niño${uChildren !== 1 ? 's' : ''}` : ''}) · {uDate && new Date(uDate).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })} a las <span className="font-bold text-emerald-700">{uTime}</span> · {uZone === 'interior' ? 'Interior' : 'Terraza'}
            </p>
          </div>

          <form onSubmit={submitReservation} className="space-y-4 max-w-md mx-auto">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Nombre *</label>
              <input type="text" required value={formName} onChange={e => setFormName(e.target.value)}
                className="w-full p-3 border-2 border-slate-200 rounded-xl font-medium text-slate-800 bg-white outline-none focus:border-emerald-600 transition-colors" placeholder="Tu nombre" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Teléfono *</label>
              <input type="tel" required value={formPhone} onChange={e => setFormPhone(e.target.value)}
                className="w-full p-3 border-2 border-slate-200 rounded-xl font-medium text-slate-800 bg-white outline-none focus:border-emerald-600 transition-colors" placeholder="612 345 678" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Email</label>
              <input type="email" value={formEmail} onChange={e => setFormEmail(e.target.value)}
                className="w-full p-3 border-2 border-slate-200 rounded-xl font-medium text-slate-800 bg-white outline-none focus:border-emerald-600 transition-colors" placeholder="tu@email.com" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Notas / Alergias</label>
              <input type="text" value={formNotes} onChange={e => setFormNotes(e.target.value)}
                className="w-full p-3 border-2 border-slate-200 rounded-xl font-medium text-slate-800 bg-white outline-none focus:border-emerald-600 transition-colors" placeholder="Alergias, silla de bebé..." />
            </div>

            {/* Términos y Privacidad */}
            <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
              <details className="group">
                <summary className="flex items-center justify-between p-4 cursor-pointer text-xs font-bold text-slate-500 hover:text-slate-800 uppercase tracking-widest select-none [&::-webkit-details-marker]:hidden">
                  <span>Condiciones de Reserva y Protección de Datos</span>
                  <svg className="w-4 h-4 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </summary>
                <div className="px-4 pb-4 space-y-4 text-[12px] text-slate-600 leading-relaxed max-h-52 overflow-y-auto border-t border-slate-100 pt-4">
                  <div>
                    <h4 className="font-bold text-slate-800 text-xs uppercase tracking-widest mb-2">1. Condiciones de Reserva</h4>
                    <p>La reserva se confirma una vez recibida y procesada por el sistema. El restaurante se reserva el derecho de modificar o cancelar la reserva en caso de incidencias técnicas o de aforo, informando al cliente por los medios facilitados. En caso de no presentarse sin aviso previo, el restaurante podrá requerir una tarjeta de garantía para futuras reservas de grupos numerosos.</p>
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 text-xs uppercase tracking-widest mb-2">2. Responsabilidad del Cliente</h4>
                    <p>El cliente se compromete a facilitar datos veraces y actualizados. Es responsable de cualquier daño que pueda ocasionar en las instalaciones durante su visita. La información sobre alergias o restricciones alimentarias se facilita voluntariamente; el restaurante hará lo posible por atenderlas pero no puede garantizar la ausencia total de trazas.</p>
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 text-xs uppercase tracking-widest mb-2">3. Protección de Datos (RGPD)</h4>
                    <p><strong>Responsable del tratamiento:</strong> Restaurante Valdelavilla · CIF pendiente de verificación · Domicilio social en [Dirección del Restaurante].</p>
                    <p><strong>Finalidad del tratamiento:</strong> Gestionar las reservas solicitadas, enviar recordatorios de la cita, comunicar cambios o cancelaciones, y mantener un histórico de visitas para mejorar la experiencia del cliente.</p>
                    <p><strong>Base legítima:</strong> Ejecución de un contrato (la reserva) y consentimiento explícito del interesado.</p>
                    <p><strong>Destinatarios:</strong> Los datos no se cederán a terceros salvo obligación legal. Se utilizan servicios de alojamiento cloud (Vercel Inc., Google Cloud) con sede en EEUU, acogidos al Privacy Framework UE-EEUU.</p>
                    <p><strong>Plazo de conservación:</strong> Los datos personales se conservarán durante la vigencia de la relación comercial y, una vez finalizada, durante el plazo legal de prescripción de responsabilidades (máximo 5 años).</p>
                    <p><strong>Derechos del interesado:</strong> Puede ejercer sus derechos de acceso, rectificación, supresión, limitación, portabilidad y oposición dirigiéndose a <strong>reservas@tu-restaurante.com</strong>. Tiene derecho a presentar una reclamación ante la Agencia Española de Protección de Datos (AEPD).</p>
                    <p><strong>Comunicaciones electrónicas:</strong> Al facilitar su email y teléfono, el cliente consiente recibir comunicaciones relacionadas con su reserva (confirmación, recordatorio, modificaciones). Así mismo, autoriza el envío de un mensaje de WhatsApp tras la visita para solicitar una valoración de la experiencia, sin que ello implique el envío de publicidad ni comunicaciones comerciales.</p>
                  </div>
                </div>
              </details>
              <div className="flex items-start gap-3 p-4 border-t border-slate-100 bg-slate-50/50">
                <input type="checkbox" id="terms-check" checked={formAccepted} onChange={e => setFormAccepted(e.target.checked)}
                  className="mt-1 w-5 h-5 rounded border-slate-300 text-emerald-700 focus:ring-[#3b526d] cursor-pointer shrink-0" />
                <label htmlFor="terms-check" className="text-[11px] text-slate-500 font-medium leading-relaxed cursor-pointer select-none">
                  He leído y acepto las <strong className="text-slate-700">condiciones de reserva</strong> y la <strong className="text-slate-700">política de privacidad</strong> según el Reglamento General de Protección de Datos (RGPD).
                </label>
              </div>
            </div>

            {bookingResult?.error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
                <p className="font-bold text-red-700 text-sm">{bookingResult.error}</p>
              </div>
            )}

            <button type="submit" disabled={submitting || !formName || !formPhone || isExpired || !formAccepted}
              className={`w-full text-white py-4 rounded-2xl font-bold uppercase tracking-widest text-sm shadow-lg transition-all flex items-center justify-center gap-2
                bg-emerald-600 hover:bg-emerald-700
                disabled:bg-slate-300 disabled:text-slate-500
              `}>
              {submitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full spinner"></div>
                  Procesando...
                </>
              ) : (
                <>
                  <Check className="w-5 h-5" />
                  {editId ? 'Guardar Cambios' : 'Confirmar Reserva'}
                </>
              )}
            </button>

            {editId && !isExpired && !submitting && (
              <button type="button" onClick={cancelReservation}
                className="w-full bg-white border-2 border-red-200 text-red-600 hover:bg-red-50 py-3 rounded-2xl font-bold uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-2 mt-2">
                Cancelar Reserva
              </button>
            )}
          </form>
        </section>
      )}

      {/* ═══ STEP 4: Confirmation ═══ */}
      {step === 4 && bookingResult?.success && (
        <section className="step-container text-center">
          <div className="bg-green-50 border-2 border-green-200 rounded-3xl p-8 max-w-md mx-auto">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-extrabold text-green-800 mb-2">{bookingResult.message || '¡Reserva Confirmada!'}</h2>
            <p className="text-green-700 font-medium mb-6">{editId ? 'Los cambios se han guardado correctamente.' : 'Tu mesa está reservada. Te esperamos.'}</p>
            <div className="bg-white rounded-xl p-4 text-left space-y-2 mb-6">
              <p className="text-sm text-slate-600"><span className="font-bold">Nombre:</span> {formName}</p>
              <p className="text-sm text-slate-600"><span className="font-bold">Fecha:</span> {uDate && new Date(uDate).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
              <p className="text-sm text-slate-600"><span className="font-bold">Hora:</span> {uTime}</p>
              <p className="text-sm text-slate-600"><span className="font-bold">Comensales:</span> {uAdults + uChildren} ({uAdults} adulto{uAdults !== 1 ? 's' : ''} + {uChildren} niño{uChildren !== 1 ? 's' : ''})</p>
              <p className="text-sm text-slate-600"><span className="font-bold">Zona:</span> {uZone === 'interior' ? 'Interior' : 'Terraza'}</p>
            </div>
            <button onClick={() => { setStep(1); setUDate(null); setUTime(null); setUZone(null); setUTotal(null); setUAdults(null); setUChildren(null); setShowChildrenInput(false); setFormName(''); setFormPhone(''); setFormEmail(''); setFormNotes(''); setBookingResult(null); }}
              className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-xl font-bold uppercase tracking-widest text-sm shadow-lg transition-all">
              Nueva Reserva
            </button>
          </div>
        </section>
      )}

      {/* ═══ Email popup ═══ */}
      {showEmailPopup && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setShowEmailPopup(false)}>
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl border border-slate-200 p-6 animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="text-center mb-4">
              <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Info className="w-6 h-6 text-amber-600" />
              </div>
              <h3 className="text-lg font-extrabold text-slate-800">¿Quieres añadir un email?</h3>
              <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                No es obligatorio, pero con el email podrás <strong>modificar</strong> o <strong>cancelar</strong> tu reserva online sin necesidad de llamar.
              </p>
            </div>
            <input type="email" value={popupEmail} onChange={e => setPopupEmail(e.target.value)}
              className="w-full p-3 border-2 border-slate-200 rounded-xl font-medium text-slate-800 bg-white outline-none focus:border-emerald-600 transition-colors mb-4" placeholder="tu@email.com" autoFocus />
            <button onClick={() => { setShowEmailPopup(false); doSubmit(popupEmail); }}
              disabled={submitting || !popupEmail}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:text-slate-500 text-white py-3 rounded-xl font-bold text-sm shadow-lg transition-all flex items-center justify-center gap-2 mb-2">
              Añadir email y continuar
            </button>
            <button onClick={() => { setShowEmailPopup(false); doSubmit(''); }}
              disabled={submitting}
              className="w-full bg-white border-2 border-slate-200 text-slate-600 hover:bg-slate-50 py-3 rounded-xl font-bold text-sm transition-all">
              Continuar sin email
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="text-center mt-12 pb-8">
        <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest">Restaurante Valdelavilla · Reservas Online</p>
      </footer>
    </main>
  );
}



