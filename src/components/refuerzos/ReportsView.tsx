import { useState, useMemo, useRef } from 'react';
import { useAppContext } from '@/context/AppContext';
import { RefuerzoRecord } from '@/types/refuerzos';
import { Eye, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { getEffectivePestName } from '@/lib/dataProcessor';

const MONTH_NAMES_FULL = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const MONTHS_SHORT = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

export default function ReportsView() {
  const { processedData, isGrouped } = useAppContext();
  const [reportType, setReportType] = useState<'month' | 'week' | 'day'>('month');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [reportHtml, setReportHtml] = useState<string | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    processedData.forEach(d => {
      if (d.dateObj) {
        const y = d.dateObj.getFullYear();
        const m = d.dateObj.getMonth();
        set.add(`${y}-${String(m + 1).padStart(2, '0')}`);
      }
    });
    return Array.from(set).sort().reverse();
  }, [processedData]);

  const formatMonthLabel = (key: string) => {
    const [y, m] = key.split('-');
    return `${MONTH_NAMES_FULL[parseInt(m) - 1]} ${y}`;
  };

  const generatePreview = () => {
    let filteredData: RefuerzoRecord[] = [];
    let prevData: RefuerzoRecord[] = [];
    let periodLabel = '';

    if (reportType === 'month') {
      if (!selectedMonth) { toast.warning('Selecciona un mes'); return; }
      const [y, mStr] = selectedMonth.split('-').map(Number);
      filteredData = processedData.filter(d => d.dateObj && d.dateObj.getFullYear() === y && d.dateObj.getMonth() + 1 === mStr);
      periodLabel = `Mensual: ${MONTH_NAMES_FULL[mStr - 1]} ${y}`;

      let prevY = y, prevM = mStr - 1;
      if (prevM === 0) { prevM = 12; prevY = y - 1; }
      prevData = processedData.filter(d => d.dateObj && d.dateObj.getFullYear() === prevY && d.dateObj.getMonth() + 1 === prevM);
    } else if (reportType === 'day') {
      if (!selectedDate) { toast.warning('Selecciona una fecha'); return; }
      filteredData = processedData.filter(d => d.dateObj && d.dateObj.toISOString().split('T')[0] === selectedDate);
      periodLabel = `Diario: ${selectedDate}`;
    } else if (reportType === 'week') {
      if (!selectedDate) { toast.warning('Selecciona una fecha de inicio'); return; }
      const startDate = new Date(selectedDate);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 6);
      filteredData = processedData.filter(d => d.dateObj && d.dateObj >= startDate && d.dateObj <= endDate);
      periodLabel = `Semanal: ${startDate.toLocaleDateString('es-ES')} al ${endDate.toLocaleDateString('es-ES')}`;

      const prevStart = new Date(startDate);
      prevStart.setDate(prevStart.getDate() - 7);
      const prevEnd = new Date(prevStart);
      prevEnd.setDate(prevEnd.getDate() + 6);
      prevData = processedData.filter(d => d.dateObj && d.dateObj >= prevStart && d.dateObj <= prevEnd);
    }

    if (filteredData.length === 0) {
      setReportHtml('<div style="text-align:center;padding:50px;color:#94a3b8;">No hay datos para el periodo seleccionado.</div>');
      return;
    }

    // Compute stats
    const counts = { total: filteredData.length, high: 0, mid: 0, low: 0, pests: {} as Record<string, number>, clients: {} as Record<string, number>, techs: {} as Record<string, number> };
    filteredData.forEach(r => {
      if (r.gravedad === 'Alto') counts.high++;
      else if (r.gravedad === 'Medio') counts.mid++;
      else counts.low++;
      const p = getEffectivePestName(r.plaga, isGrouped);
      counts.pests[p] = (counts.pests[p] || 0) + 1;
      counts.clients[r.cliente] = (counts.clients[r.cliente] || 0) + 1;
      if (r.tecnico) counts.techs[r.tecnico] = (counts.techs[r.tecnico] || 0) + 1;
    });

    // Change analysis
    const currentKeys = new Set(filteredData.map(r => `${r.cliente}|${getEffectivePestName(r.plaga, isGrouped)}`));
    const prevKeys = new Set(prevData.map(r => `${r.cliente}|${getEffectivePestName(r.plaga, isGrouped)}`));
    const newCases = [...currentKeys].filter(k => !prevKeys.has(k)).length;
    const solvedCases = [...prevKeys].filter(k => !currentKeys.has(k)).length;

    // Recurrence
    const recMap: Record<string, Set<string>> = {};
    const activeClients = Object.keys(counts.clients);
    processedData.forEach(r => {
      if (activeClients.includes(r.cliente) && r.dateObj) {
        const key = `${r.cliente}|${getEffectivePestName(r.plaga, isGrouped)}`;
        const mKey = `${r.dateObj.getFullYear()}-${r.dateObj.getMonth()}`;
        if (!recMap[key]) recMap[key] = new Set();
        recMap[key].add(mKey);
      }
    });
    const topRecurrent = Object.entries(recMap)
      .map(([k, set]) => { const [c, p] = k.split('|'); return { cliente: c, plaga: p, meses: set.size }; })
      .sort((a, b) => b.meses - a.meses)
      .slice(0, 5);

    const topPest = Object.entries(counts.pests).sort((a, b) => b[1] - a[1])[0] || ['Ninguna', 0];
    const highRiskPerc = counts.total > 0 ? ((counts.high / counts.total) * 100).toFixed(1) : '0';
    const topTech = Object.entries(counts.techs).sort((a, b) => b[1] - a[1])[0];

    const changesTrend = newCases > solvedCases
      ? `<span style="color:#ef4444">NEGATIVA</span>. +${newCases} nuevos vs -${solvedCases} resueltos.`
      : `<span style="color:#22c55e">POSITIVA</span>. +${newCases} nuevos vs -${solvedCases} resueltos.`;

    const today = new Date().toLocaleDateString('es-ES');

    const html = `
      <div style="font-family:'Segoe UI',system-ui,sans-serif;max-width:800px;margin:0 auto;padding:30px;">
        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #1e293b;padding-bottom:15px;margin-bottom:20px;">
          <div>
            <h1 style="margin:0;font-size:1.4rem;color:#1e293b;">Reporte de Control de Plagas</h1>
            <p style="margin:5px 0 0;color:#64748b;font-size:0.85rem;">Periodo: ${periodLabel}</p>
          </div>
          <div style="text-align:right;font-size:0.8rem;color:#64748b;">
            Generado: ${today}
          </div>
        </div>

        <h2 style="font-size:1rem;color:#1e293b;border-bottom:1px solid #e2e8f0;padding-bottom:8px;">Resumen General</h2>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px;">
          <div style="background:#f8fafc;padding:12px;border-radius:8px;text-align:center;border:1px solid #e2e8f0;">
            <div style="font-size:1.5rem;font-weight:700;">${counts.total}</div>
            <div style="font-size:0.75rem;color:#64748b;">Total Registros</div>
          </div>
          <div style="background:#fef2f2;padding:12px;border-radius:8px;text-align:center;border:1px solid #fecaca;">
            <div style="font-size:1.5rem;font-weight:700;color:#ef4444;">${counts.high}</div>
            <div style="font-size:0.75rem;color:#64748b;">Alto Riesgo</div>
          </div>
          <div style="background:#fffbeb;padding:12px;border-radius:8px;text-align:center;border:1px solid #fde68a;">
            <div style="font-size:1.5rem;font-weight:700;color:#f59e0b;">${counts.mid}</div>
            <div style="font-size:0.75rem;color:#64748b;">Riesgo Medio</div>
          </div>
          <div style="background:#f0fdf4;padding:12px;border-radius:8px;text-align:center;border:1px solid #bbf7d0;">
            <div style="font-size:1.5rem;font-weight:700;color:#22c55e;">${counts.low}</div>
            <div style="font-size:0.75rem;color:#64748b;">Riesgo Bajo</div>
          </div>
        </div>

        <h2 style="font-size:1rem;color:#1e293b;border-bottom:1px solid #e2e8f0;padding-bottom:8px;">Análisis</h2>
        <div style="background:#f0f9ff;border:1px solid #bae6fd;border-left:4px solid #0284c7;padding:12px;border-radius:6px;margin-bottom:15px;font-size:0.9rem;">
          <p style="margin:0 0 8px;"><strong>Gravedad:</strong> El ${highRiskPerc}% de los hallazgos fueron de Alto Riesgo.</p>
          <p style="margin:0 0 8px;"><strong>Plaga predominante:</strong> ${topPest[0]} (${topPest[1]} casos).</p>
          <p style="margin:0 0 8px;"><strong>Tendencia de cambios:</strong> ${changesTrend}</p>
          ${topTech ? `<p style="margin:0;"><strong>Técnico líder:</strong> ${topTech[0]} (${topTech[1]} servicios).</p>` : ''}
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:15px;margin-bottom:20px;">
          <div>
            <h3 style="font-size:0.9rem;color:#1e293b;margin-bottom:8px;">Top Plagas</h3>
            <table style="width:100%;border-collapse:collapse;font-size:0.8rem;">
              <tr style="background:#f1f5f9;"><th style="padding:6px;text-align:left;">Plaga</th><th style="padding:6px;text-align:right;">Cant.</th><th style="padding:6px;text-align:right;">%</th></tr>
              ${Object.entries(counts.pests).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) =>
      `<tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:6px;">${k}</td><td style="padding:6px;text-align:right;">${v}</td><td style="padding:6px;text-align:right;">${((v / counts.total) * 100).toFixed(1)}%</td></tr>`
    ).join('')}
            </table>
          </div>
          <div>
            <h3 style="font-size:0.9rem;color:#1e293b;margin-bottom:8px;">Top Recurrencia</h3>
            <table style="width:100%;border-collapse:collapse;font-size:0.8rem;">
              <tr style="background:#f1f5f9;"><th style="padding:6px;text-align:left;">Cliente</th><th style="padding:6px;">Plaga</th><th style="padding:6px;text-align:center;">Hist.</th></tr>
              ${topRecurrent.map(r =>
      `<tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:6px;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${r.cliente}</td><td style="padding:6px;">${r.plaga}</td><td style="padding:6px;text-align:center;"><span style="background:#eff6ff;color:#2563eb;padding:2px 6px;border-radius:8px;font-size:0.75rem;">${r.meses}m</span></td></tr>`
    ).join('')}
            </table>
          </div>
        </div>

        <h2 style="font-size:1rem;color:#1e293b;border-bottom:1px solid #e2e8f0;padding-bottom:8px;">Desempeño Operativo</h2>
        <table style="width:100%;border-collapse:collapse;font-size:0.8rem;margin-bottom:15px;">
          <tr style="background:#f1f5f9;"><th style="padding:6px;text-align:left;">Técnico</th><th style="padding:6px;text-align:right;">Servicios</th></tr>
          ${Object.entries(counts.techs).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) =>
      `<tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:6px;">${k}</td><td style="padding:6px;text-align:right;">${v}</td></tr>`
    ).join('')}
        </table>
      </div>
    `;

    setReportHtml(html);
  };

  const handlePrint = () => {
    if (!reportHtml) {
      toast.warning('Primero genera una vista previa del reporte.');
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('No se pudo abrir la ventana de impresión. Verifica los popups.');
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html><head><title>Reporte de Control de Plagas</title>
      <style>
        @media print {
          body { margin: 0; }
          @page { margin: 1cm; }
        }
      </style>
      </head><body>${reportHtml}</body></html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 500);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Controls */}
      <div className="flex flex-wrap gap-4 items-end bg-card p-4 rounded-lg border border-border">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tipo de Reporte</label>
          <select
            value={reportType}
            onChange={e => setReportType(e.target.value as 'month' | 'week' | 'day')}
            className="text-sm p-2 rounded-md border border-border bg-card"
          >
            <option value="month">Mensual</option>
            <option value="week">Semanal</option>
            <option value="day">Diario</option>
          </select>
        </div>

        {reportType === 'month' ? (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Seleccionar Mes</label>
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="text-sm p-2 rounded-md border border-border bg-card"
            >
              <option value="">Selecciona...</option>
              {availableMonths.map(k => (
                <option key={k} value={k}>{formatMonthLabel(k)}</option>
              ))}
            </select>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {reportType === 'week' ? 'Fecha Inicio de Semana' : 'Seleccionar Fecha'}
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="text-sm p-2 rounded-md border border-border bg-card"
            />
          </div>
        )}

        <button
          onClick={generatePreview}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md font-medium text-sm hover:opacity-90 transition-all"
        >
          <Eye className="w-4 h-4" />
          Vista Previa
        </button>

        <button
          onClick={handlePrint}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md font-medium text-sm hover:opacity-90 transition-all"
        >
          <Printer className="w-4 h-4" />
          Imprimir / Guardar como PDF
        </button>
      </div>

      {/* Preview */}
      <div className="bg-card rounded-lg border border-border overflow-auto" style={{ maxHeight: 'calc(100vh - 200px)' }}>
        <div ref={reportRef}>
          {reportHtml ? (
            <div dangerouslySetInnerHTML={{ __html: reportHtml }} />
          ) : (
            <div className="text-center text-muted-foreground py-20">
              Selecciona un periodo y haz clic en "Vista Previa" para generar el reporte.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
