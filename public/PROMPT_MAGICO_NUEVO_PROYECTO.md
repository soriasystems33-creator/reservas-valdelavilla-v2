# 🪄 Prompt Blindado para Replicar en un Nuevo Proyecto (Con Código Exacto Incluido)

Tienes toda la razón: **para que la IA no invente nada ni se equivoque con nombres de variables**, lo más seguro y blindado es **darle el código exacto dentro del propio prompt**.

Tú **sigues sin tocar ni una línea de código a mano**: simplemente copias el recuadro gris de abajo (que ya lleva las instrucciones y el código exacto dentro) y se lo pegas a la IA del nuevo proyecto en el chat. La IA se encargará de insertarlo en su sitio sin romper nada.

---

## 📋 PROMPT BLINDADO PARA COPIAR Y PEGAR EN EL CHAT DEL NUEVO PROYECTO

Copia **todo** este recuadro y pégalo en el chat de la IA cuando abras un nuevo cliente:

```text
Hola. Necesito que añadas automáticamente a este proyecto el "Sistema de Copia de Seguridad JSON y Rescate sin Duplicados" en el panel de administración web.
Por favor, realiza los siguientes dos cambios integrando EXACTAMENTE el código que te proporciono abajo, sin alterar ni romper ninguna funcionalidad existente:

1. En el archivo HTML principal de administración (`admin.html`):
   - Busca el cierre de la sección de Ajustes (`#view-settings`) y pega ESTE BLOQUE de botones discretos justo antes de cerrar ese contenedor:

<!-- Botones discretos de backup y restauración (Abajo a la derecha) -->
<div class="flex justify-end items-center gap-2 pt-4 opacity-40 hover:opacity-100 transition-opacity">
    <input type="file" id="restore-file-input" accept=".json,application/json" class="hidden" onchange="handleRestoreFileSelect(event)">
    <button onclick="exportBackupJSON()" class="text-[11px] font-medium text-slate-500 hover:text-slate-300 bg-transparent hover:bg-[#1e1e2d] px-2.5 py-1 rounded transition-colors cursor-pointer flex items-center gap-1.5" title="Exportar copia JSON">
        <i data-lucide="download" class="w-3.5 h-3.5"></i> Exportar JSON
    </button>
    <button onclick="document.getElementById('restore-file-input').click()" class="text-[11px] font-medium text-slate-500 hover:text-slate-300 bg-transparent hover:bg-[#1e1e2d] px-2.5 py-1 rounded transition-colors cursor-pointer flex items-center gap-1.5" title="Restaurar copia JSON">
        <i data-lucide="upload" class="w-3.5 h-3.5"></i> Restaurar JSON
    </button>
    <div id="restore-progress-container" class="hidden text-right text-xs font-bold text-emerald-400">
        <span id="restore-progress-text">Restaurando...</span> <span id="restore-progress-percent">0%</span>
    </div>
</div>

2. En el archivo JavaScript principal de administración (`admin.js`):
   - Añade EXACTAMENTE ESTAS FUNCIONES al final del archivo para gestionar la exportación y el rescate sin duplicados por ID:

// ── COPIA DE SEGURIDAD Y RESCATE ──────────────────────────────────────────────
function exportBackupJSON() {
    try {
        var backupData = {
            version: 1,
            timestamp: new Date().toISOString(),
            app: "GASTROMANAGER BACKUP TOTAL",
            appointments: typeof g_appointments !== 'undefined' ? g_appointments : [],
            settings: typeof g_settings !== 'undefined' ? g_settings : {},
            tables: typeof g_tables !== 'undefined' ? g_tables : [],
            providers: typeof g_providers !== 'undefined' ? g_providers : []
        };

        var jsonString = JSON.stringify(backupData, null, 2);
        var blob = new Blob([jsonString], { type: "application/json" });
        var url = URL.createObjectURL(blob);
        
        var a = document.createElement('a');
        a.href = url;
        var dateStr = new Date().toISOString().split('T')[0];
        a.download = "copia_seguridad_total_" + dateStr + ".json";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showToast('Copia de seguridad exportada correctamente');
    } catch (e) {
        console.error("Error al exportar JSON:", e);
        showToast('Error al exportar la copia de seguridad');
    }
}

function handleRestoreFileSelect(event) {
    var file = event.target.files[0];
    if (!file) return;

    var reader = new FileReader();
    reader.onload = function(e) {
        try {
            var data = JSON.parse(e.target.result);
            var appointmentsList = [];
            if (data && Array.isArray(data.appointments)) {
                appointmentsList = data.appointments;
            } else if (Array.isArray(data)) {
                appointmentsList = data;
            } else {
                alert('El archivo seleccionado no tiene un formato válido de copia de seguridad.');
                return;
            }

            if (confirm('¿Estás seguro de que deseas restaurar ' + appointmentsList.length + ' reservas desde esta copia de seguridad? Se respetarán los IDs para evitar duplicados.')) {
                restoreAppointmentsFromJSON(appointmentsList);
            }
        } catch (err) {
            console.error("Error leyendo JSON de rescate:", err);
            alert('Error al leer el archivo JSON.');
        }
        event.target.value = '';
    };
    reader.readAsText(file);
}

async function restoreAppointmentsFromJSON(appointmentsList) {
    var container = document.getElementById('restore-progress-container');
    var barEl = document.getElementById('restore-progress-bar');
    var pctEl = document.getElementById('restore-progress-percent');
    
    if (container) container.classList.remove('hidden');
    if (barEl) barEl.style.width = '0%';
    if (pctEl) pctEl.innerText = '0%';

    var successCount = 0;
    var total = appointmentsList.length;

    for (var i = 0; i < total; i++) {
        var appt = appointmentsList[i];
        try {
            if (!appt.id) {
                appt.id = 'res-restore-' + appt.date + '-' + (appt.time||'0000').replace(':','') + '-' + Math.random().toString(36).substr(2,6);
            }
            if (typeof appt.date === 'string' && appt.date.indexOf('T') > -1) {
                appt.date = appt.date.split('T')[0];
            }
            if (!appt.updated_at) {
                appt.updated_at = new Date().toISOString();
            }

            await doc(appt.id).set(appt, { merge: true });
            successCount++;
        } catch (err) {
            console.error("Error restaurando reserva id:", appt.id, err);
        }

        var pct = Math.round(((i + 1) / total) * 100);
        if (barEl) barEl.style.width = pct + '%';
        if (pctEl) pctEl.innerText = pct + '%';
    }

    if (container) {
        setTimeout(function() { container.classList.add('hidden'); }, 2000);
    }

    await syncAllAppointments();
    if (typeof renderAll === 'function') renderAll();

    showToast('¡Rescate completado! ' + successCount + ' / ' + total + ' reservas sincronizadas.');
}
```

---

## 🛠️ Tu Parte (1 minuto en n8n):
1. En n8n, vas a **Workflows ➔ Import from File** y subes **`n8n-backup-diario-workflow.json`**.
2. Cambias en los nodos las **3 credenciales** de ese restaurante (Supabase, Google Sheets y Google Drive).
3. Pones el interruptor de n8n en **Active (ON)**.

¡Con este prompt la IA tiene el código exacto y 0% margen de error o alucinación!
