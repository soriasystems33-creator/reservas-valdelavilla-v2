# 🚀 Guía de Despliegue Rápido: Sistema de Copias de Seguridad para Nuevos Clientes

Esta guía explica cómo replicar todo el sistema de **Copia de Seguridad Automática en n8n (Sheets + Drive JSON)** y de **Rescate / Restauración sin duplicados desde el Panel Web** para cualquier nuevo cliente o restaurante en menos de **5 minutos**.

---

## 1️⃣ Configuración en n8n (1 minuto)

### Paso A: Importar el Workflow
1. En el n8n del nuevo cliente, ve a **Workflows ➔ Add Workflow**.
2. Haz clic en los tres puntos superior derecha (**...**) ➔ **Import from File**.
3. Sube el archivo **`n8n-backup-diario-workflow.json`** que tenemos en el proyecto.

### Paso B: Conectar las 3 Credenciales del Cliente
1. **Nodos de Base de Datos (`1. Leer Reservas` y `2. Leer Base de Datos Completa`):**
   * Selecciona la credencial de **Postgres/Supabase** del nuevo cliente.
2. **Nodo `Sincronizar en Google Sheets`:**
   * Selecciona su credencial de **Google Sheets OAuth2 API**.
   * En el campo **Document / Spreadsheet ID**, pega el ID del Excel del cliente (de su barra de direcciones `/d/ESTE_ID/edit`).
   * Asegúrate de que en la Fila 1 de ese Excel tenga las cabeceras:
     `id | Fecha | Hora | Turno | Cliente | Personas | Zona | Teléfono | Notas / Alergias | Estado`
3. **Nodo `Guardar archivo JSON TOTAL en Google Drive`:**
   * Selecciona su credencial de **Google Drive OAuth2 API**.
   * Selecciona la carpeta de Drive del cliente donde quieras que caigan las copias diarias.

### Paso C: Activar
* Pon el interruptor superior del workflow en **Active (ON)**. ¡El backup automático ya está funcionando!

---

## 2️⃣ Configuración en el Panel Web del Nuevo Cliente (2 minutos)

Si el nuevo cliente utiliza una estructura similar de panel, solo necesitas pegar dos bloques:

### A) En el archivo HTML de Ajustes (`admin.html`)
Pega estos dos botones discretos justo antes del cierre de la vista de ajustes (`#view-settings`):

```html
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
```

### B) En el archivo JS del Panel (`admin.js`)
Pega estas funciones (que gestionan la exportación completa y la restauración con `upsert/merge` por ID sin duplicados):

```javascript
// ── COPIA DE SEGURIDAD Y RESCATE ──────────────────────────────────────────────
function exportBackupJSON() {
    try {
        var backupData = {
            version: 1,
            timestamp: new Date().toISOString(),
            app: "GASTROMANAGER BACKUP TOTAL",
            appointments: g_appointments || [],
            settings: g_settings || {},
            tables: g_tables || [],
            providers: g_providers || []
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
