import { db } from '../../../lib/supabase-admin';
import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const time = searchParams.get('time');
    if (!date) {
      return NextResponse.json({ error: 'Falta parámetro date' }, { status: 400 });
    }

    // Obtener settings (incluye cutoffTime)
    const settingsDoc = await db.doc('settings/main').get();
    const settings = settingsDoc.exists ? settingsDoc.data() : { shiftTemplates: [], defaultTemplateId: '', specialDays: {}, cutoffTime: '12:30' };

    // Validar hora límite configurable para hoy (en hora local España)
    const now = new Date();
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(now);
    const get = (t) => parseInt(parts.find(p => p.type === t)?.value || '0', 10);
    const year = get('year'), month = String(get('month')).padStart(2,'0'), day = String(get('day')).padStart(2,'0');
    const currentHour = get('hour'), currentMinute = get('minute');
    const todayStr = `${year}-${month}-${day}`;
    if (date < todayStr) {
      return NextResponse.json({ shifts: [], availability: {} });
    }

    // Calcular turnos para la fecha
    let shifts = getShiftsForDate(date, settings);
    
    if (date === todayStr) {
      const todaySpecial = settings.specialDays && settings.specialDays[todayStr];
      const lunchCutoff = '12:30';
      const dinnerCutoff = '20:00';
      const [lH, lM] = lunchCutoff.split(':').map(Number);
      const [dH, dM] = dinnerCutoff.split(':').map(Number);
      
      const isPastLunch = currentHour > lH || (currentHour === lH && currentMinute >= lM);
      const isPastDinner = currentHour > dH || (currentHour === dH && currentMinute >= dM);
      
      shifts = shifts.filter(s => {
        const [sh, sm] = s.time.split(':').map(Number);
        const isDinner = sh >= 17;
        
        const slotMins = sh * 60 + sm;
        const nowMins = currentHour * 60 + currentMinute;
        if (slotMins < nowMins + 30) return false;

        if (isDinner) {
            return !isPastDinner;
        } else {
            return !isPastLunch;
        }
      });
    }

    // Si piden un turno concreto, filtrar
    const targetShifts = time ? shifts.filter(s => s.time === time) : shifts;
    const exactMatch = !time || targetShifts.length > 0;
    // Si no hay match exacto, devolver TODOS los turnos del día como alternativas
    const finalShifts = targetShifts.length > 0 ? targetShifts : shifts;
    if (finalShifts.length === 0) {
      return NextResponse.json({ shifts: [], availability: {}, exactMatch: false, requestedTime: time || null });
    }

    // Obtener reservas activas para esa fecha
    const snapshot = await db.collection('appointments')
      .where('date', '==', date)
      .get();
    
    const appointments = [];
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      // Normalizar fecha Timestamp
      if (data.date && typeof data.date.toDate === 'function') {
        const td = data.date.toDate();
        data.date = td.getFullYear() + '-' + String(td.getMonth()+1).padStart(2,'0') + '-' + String(td.getDate()).padStart(2,'0');
      }
      if (data.pax && typeof data.pax === 'object' && data.pax.integerValue) data.pax = parseInt(data.pax.integerValue) || 1;
      if (data.status !== 'cancelled' && data.status !== 'noshow' && data.status !== 'waiting') {
        appointments.push(data);
      }
    });

    // Calcular disponibilidad por turno y zona
    const availability = {};
    finalShifts.forEach(s => {
      const shiftAppts = appointments.filter(a => a.time === s.time);
      const occInt = shiftAppts.filter(a => a.zone === 'interior').reduce((sum, a) => sum + (a.pax || 0), 0);
      const occExt = shiftAppts.filter(a => a.zone === 'exterior').reduce((sum, a) => sum + (a.pax || 0), 0);
      const capInt = s.capInterior !== undefined ? s.capInterior : (s.cap || 50);
      const capExt = s.capExterior !== undefined ? s.capExterior : 100;
      
      const realFreeInt = capInt - occInt;
      const realFreeExt = capExt - occExt;
      
      // Margen de cortesía: si queda al menos 1 hueco libre, se permiten hasta 5 personas por encima del aforo.
      const freeInt = realFreeInt > 0 ? realFreeInt + 5 : 0;
      const freeExt = realFreeExt > 0 ? realFreeExt + 5 : 0;

      availability[s.time] = {
        interior: { free: freeInt, total: capInt },
        exterior: { free: freeExt, total: capExt },
        totalFree: freeInt + freeExt,
      };
    });

    return NextResponse.json({
      shifts: finalShifts.map(s => ({
        time: s.time,
        name: s.name || s.time,
      })),
      availability,
      exactMatch,
      requestedTime: time || null,
    });
  } catch (error) {
    console.error('Error fetching availability:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

function getShiftsForDate(dateStr, settings) {
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
  // Si terraza está cerrada (global o por turno), poner capacidad exterior a 0
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
}


export const dynamic = 'force-dynamic';
