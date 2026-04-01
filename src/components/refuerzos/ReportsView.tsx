import { useState, useMemo, useRef } from 'react';
import { useAppContext, PEST_COLORS } from '@/context/AppContext';
import { RefuerzoRecord } from '@/types/refuerzos';
import { Eye, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { getEffectivePestName } from '@/lib/dataProcessor';

const MONTH_NAMES_FULL = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

export default function ReportsView() {
  const { currentData, metrics, yearFilter, monthFilter, techFilter, isGrouped, selectedPests, processedData } = useAppContext();
  const [reportHtml, setReportHtml] = useState<string | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  const filterLabel = useMemo(() => {
    const parts: string[] = [];
    if (yearFilter !== 'all') parts.push(`Año: ${yearFilter}`);
    if (monthFilter !== 'all') parts.push(`Mes: ${MONTH_NAMES_FULL[parseInt(monthFilter)]}`);
    if (techFilter !== 'all') parts.push(`Técnico: ${techFilter}`);
    return parts.length > 0 ? parts.join(' | ') : 'Todos los datos';
  }, [yearFilter, monthFilter, techFilter]);

  const generatePreview = () => {
    if (currentData.length === 0) {
      setReportHtml('<div style="text-align:center;padding:50px;color:#94a3b8;">No hay datos con los filtros aplicados.</div>');
      return;
    }
    if (!metrics) return;

    const today = new Date().toLocaleDateString('es-ES');

    // Top lists
    const topPests = Object.entries(metrics.plagas).sort((a, b) => b[1] - a[1]).slice(0, 10);
    const topClients = Object.entries(metrics.clients).sort((a, b) => b[1] - a[1]).slice(0, 10);
    const topTechs = Object.entries(metrics.tecnicos).sort((a, b) => b[1] - a[1]).slice(0, 10);
    const criticalCases = metrics.criticalCases.sort((a, b) => b.diasActivos - a.diasActivos).slice(0, 10);

    // Severity timeline
    const timelineData = Object.values(metrics.timeline).sort((a, b) => a.sortKey.localeCompare(b.sortKey));

    // Pest trend
    const pestTrendData = Object.values(metrics.pestTrend).sort((a, b) => a.sortKey.localeCompare(b.sortKey));

    // Recurrence analysis
    const recMap: Record<string, Set<string>> = {};
    const activeClients = Object.keys(metrics.clients);
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
      .slice(0, 10);

    // Priority cases (>15 dias activos)
    const priorityCases = currentData.filter(r => r.diasActivos > 15);
    const highPriority = priorityCases.filter(r => r.gravedad === 'Alto');

    // Trend analysis
    const monthlyActivity: Record<string, number> = {};
    currentData.forEach(r => {
      if (r.dateObj) {
        const key = `${r.dateObj.getFullYear()}-${String(r.dateObj.getMonth() + 1).padStart(2, '0')}`;
        monthlyActivity[key] = (monthlyActivity[key] || 0) + 1;
      }
    });
    const sortedMonths = Object.keys(monthlyActivity).sort();
    let trendText = 'Estable';
    let trendColor = '#64748b';
    if (sortedMonths.length >= 2) {
      const last = monthlyActivity[sortedMonths[sortedMonths.length - 1]];
      const prev = monthlyActivity[sortedMonths[sortedMonths.length - 2]];
      if (last > prev) { trendText = `Tendencia al ALZA (+${last - prev} vs mes anterior)`; trendColor = '#ef4444'; }
      else if (last < prev) { trendText = `Tendencia a la BAJA (-${prev - last} vs mes anterior)`; trendColor = '#22c55e'; }
    }

    const highRiskPerc = metrics.total > 0 ? ((metrics.high / metrics.total) * 100).toFixed(1) : '0';
    const midRiskPerc = metrics.total > 0 ? ((metrics.mid / metrics.total) * 100).toFixed(1) : '0';

    // Build timeline table rows
    const timelineRows = timelineData.map(t =>
      `<tr style="border-bottom:1px solid #f1f5f9;">
        <td style="padding:6px;">${t.label}</td>
        <td style="padding:6px;text-align:center;color:#ef4444;font-weight:600;">${t.alto}</td>
        <td style="padding:6px;text-align:center;color:#f59e0b;font-weight:600;">${t.medio}</td>
        <td style="padding:6px;text-align:center;color:#22c55e;font-weight:600;">${t.bajo}</td>
        <td style="padding:6px;text-align:center;font-weight:700;">${t.alto + t.medio + t.bajo}</td>
      </tr>`
    ).join('');

    // Build pest trend table
    const pestTrendRows = pestTrendData.map(pt => {
      const pestCols = selectedPests.map(p => `<td style="padding:6px;text-align:center;">${pt.counts[p] || 0}</td>`).join('');
      return `<tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:6px;">${pt.label}</td>${pestCols}</tr>`;
    }).join('');

    const pestTrendHeaders = selectedPests.map((p, i) =>
      `<th style="padding:6px;text-align:center;color:${PEST_COLORS[i % PEST_COLORS.length]};">${p}</th>`
    ).join('');

    const html = `
      <div style="font-family:'Segoe UI',system-ui,sans-serif;max-width:900px;margin:0 auto;padding:30px;">
        <!-- Header -->
        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #1e293b;padding-bottom:15px;margin-bottom:20px;">
          <div>
            <h1 style="margin:0;font-size:1.4rem;color:#1e293b;">Reporte Completo de Métricas</h1>
            <p style="margin:5px 0 0;color:#64748b;font-size:0.85rem;">Filtros: ${filterLabel}</p>
          </div>
          <div style="text-align:right;font-size:0.8rem;color:#64748b;">
            Generado: ${today}<br/>
            Registros: ${metrics.total.toLocaleString()}
          </div>
        </div>

        <!-- Stats Cards -->
        <h2 style="font-size:1rem;color:#1e293b;border-bottom:1px solid #e2e8f0;padding-bottom:8px;">Resumen General</h2>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px;">
          <div style="background:#f8fafc;padding:12px;border-radius:8px;text-align:center;border:1px solid #e2e8f0;">
            <div style="font-size:1.5rem;font-weight:700;">${metrics.total.toLocaleString()}</div>
            <div style="font-size:0.75rem;color:#64748b;">Total Registros</div>
          </div>
          <div style="background:#fef2f2;padding:12px;border-radius:8px;text-align:center;border:1px solid #fecaca;">
            <div style="font-size:1.5rem;font-weight:700;color:#ef4444;">${metrics.high.toLocaleString()}</div>
            <div style="font-size:0.75rem;color:#64748b;">Alto (${highRiskPerc}%)</div>
          </div>
          <div style="background:#fffbeb;padding:12px;border-radius:8px;text-align:center;border:1px solid #fde68a;">
            <div style="font-size:1.5rem;font-weight:700;color:#f59e0b;">${metrics.mid.toLocaleString()}</div>
            <div style="font-size:0.75rem;color:#64748b;">Medio (${midRiskPerc}%)</div>
          </div>
          <div style="background:#f0fdf4;padding:12px;border-radius:8px;text-align:center;border:1px solid #bbf7d0;">
            <div style="font-size:1.5rem;font-weight:700;color:#22c55e;">${metrics.low.toLocaleString()}</div>
            <div style="font-size:0.75rem;color:#64748b;">Bajo</div>
          </div>
        </div>

        <!-- Intelligent Analysis -->
        <h2 style="font-size:1rem;color:#1e293b;border-bottom:1px solid #e2e8f0;padding-bottom:8px;">Análisis Inteligente</h2>
        <div style="background:#f0f9ff;border:1px solid #bae6fd;border-left:4px solid #0284c7;padding:12px;border-radius:6px;margin-bottom:15px;font-size:0.9rem;">
          <p style="margin:0 0 8px;"><strong>Tendencia:</strong> <span style="color:${trendColor}">${trendText}</span></p>
          <p style="margin:0 0 8px;"><strong>Casos prioritarios (&gt;15 días):</strong> ${priorityCases.length} registros${highPriority.length > 0 ? `, <span style="color:#ef4444;font-weight:600;">${highPriority.length} de gravedad Alta</span>` : ''}</p>
          <p style="margin:0 0 8px;"><strong>Plaga predominante:</strong> ${topPests[0] ? `${topPests[0][0]} (${topPests[0][1]} casos)` : 'N/A'}</p>
          <p style="margin:0;"><strong>Cliente más recurrente:</strong> ${topClients[0] ? `${topClients[0][0]} (${topClients[0][1]} registros)` : 'N/A'}</p>
        </div>

        <!-- Top Plagas & Top Clientes side by side -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:15px;margin-bottom:20px;">
          <div>
            <h3 style="font-size:0.9rem;color:#1e293b;margin-bottom:8px;">Top Plagas</h3>
            <table style="width:100%;border-collapse:collapse;font-size:0.8rem;">
              <tr style="background:#f1f5f9;"><th style="padding:6px;text-align:left;">Plaga</th><th style="padding:6px;text-align:right;">Cant.</th><th style="padding:6px;text-align:right;">%</th></tr>
              ${topPests.map(([k, v]) =>
                `<tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:6px;">${k}</td><td style="padding:6px;text-align:right;">${v}</td><td style="padding:6px;text-align:right;">${((v / metrics.total) * 100).toFixed(1)}%</td></tr>`
              ).join('')}
            </table>
          </div>
          <div>
            <h3 style="font-size:0.9rem;color:#1e293b;margin-bottom:8px;">Top Clientes Recurrentes</h3>
            <table style="width:100%;border-collapse:collapse;font-size:0.8rem;">
              <tr style="background:#f1f5f9;"><th style="padding:6px;text-align:left;">Cliente</th><th style="padding:6px;text-align:right;">Cant.</th><th style="padding:6px;text-align:right;">%</th></tr>
              ${topClients.map(([k, v]) =>
                `<tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:6px;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${k}</td><td style="padding:6px;text-align:right;">${v}</td><td style="padding:6px;text-align:right;">${((v / metrics.total) * 100).toFixed(1)}%</td></tr>`
              ).join('')}
            </table>
          </div>
        </div>

        <!-- Técnicos -->
        <h2 style="font-size:1rem;color:#1e293b;border-bottom:1px solid #e2e8f0;padding-bottom:8px;">Desempeño por Técnico</h2>
        <table style="width:100%;border-collapse:collapse;font-size:0.8rem;margin-bottom:20px;">
          <tr style="background:#f1f5f9;"><th style="padding:6px;text-align:left;">Técnico</th><th style="padding:6px;text-align:right;">Servicios</th><th style="padding:6px;text-align:right;">% del Total</th></tr>
          ${topTechs.map(([k, v]) =>
            `<tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:6px;">${k}</td><td style="padding:6px;text-align:right;">${v}</td><td style="padding:6px;text-align:right;">${((v / metrics.total) * 100).toFixed(1)}%</td></tr>`
          ).join('')}
        </table>

        <!-- Critical Cases -->
        ${criticalCases.length > 0 ? `
        <h2 style="font-size:1rem;color:#ef4444;border-bottom:1px solid #fecaca;padding-bottom:8px;">Casos Críticos (Alto + &gt;15 días)</h2>
        <table style="width:100%;border-collapse:collapse;font-size:0.8rem;margin-bottom:20px;">
          <tr style="background:#fef2f2;"><th style="padding:6px;text-align:left;">Cliente</th><th style="padding:6px;">Plaga</th><th style="padding:6px;">Dirección</th><th style="padding:6px;text-align:right;">Días Activos</th></tr>
          ${criticalCases.map(r =>
            `<tr style="border-bottom:1px solid #fecaca;"><td style="padding:6px;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${r.cliente}</td><td style="padding:6px;">${r.plaga}</td><td style="padding:6px;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${r.direccion || '-'}</td><td style="padding:6px;text-align:right;color:#ef4444;font-weight:700;">${r.diasActivos}</td></tr>`
          ).join('')}
        </table>
        ` : ''}

        <!-- Recurrence -->
        <h2 style="font-size:1rem;color:#1e293b;border-bottom:1px solid #e2e8f0;padding-bottom:8px;">Top Recurrencia Histórica</h2>
        <table style="width:100%;border-collapse:collapse;font-size:0.8rem;margin-bottom:20px;">
          <tr style="background:#f1f5f9;"><th style="padding:6px;text-align:left;">Cliente</th><th style="padding:6px;">Plaga</th><th style="padding:6px;text-align:center;">Meses</th></tr>
          ${topRecurrent.map(r =>
            `<tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:6px;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${r.cliente}</td><td style="padding:6px;">${r.plaga}</td><td style="padding:6px;text-align:center;"><span style="background:#eff6ff;color:#2563eb;padding:2px 8px;border-radius:8px;font-size:0.75rem;">${r.meses}m</span></td></tr>`
          ).join('')}
        </table>

        <!-- Severity Timeline -->
        ${timelineData.length > 0 ? `
        <h2 style="font-size:1rem;color:#1e293b;border-bottom:1px solid #e2e8f0;padding-bottom:8px;">Línea de Tiempo por Gravedad</h2>
        <table style="width:100%;border-collapse:collapse;font-size:0.8rem;margin-bottom:20px;">
          <tr style="background:#f1f5f9;">
            <th style="padding:6px;text-align:left;">Periodo</th>
            <th style="padding:6px;text-align:center;color:#ef4444;">Alto</th>
            <th style="padding:6px;text-align:center;color:#f59e0b;">Medio</th>
            <th style="padding:6px;text-align:center;color:#22c55e;">Bajo</th>
            <th style="padding:6px;text-align:center;">Total</th>
          </tr>
          ${timelineRows}
        </table>
        ` : ''}

        <!-- Pest Trend -->
        ${pestTrendData.length > 0 && selectedPests.length > 0 ? `
        <h2 style="font-size:1rem;color:#1e293b;border-bottom:1px solid #e2e8f0;padding-bottom:8px;">Tendencia por Plaga</h2>
        <table style="width:100%;border-collapse:collapse;font-size:0.8rem;margin-bottom:20px;">
          <tr style="background:#f1f5f9;">
            <th style="padding:6px;text-align:left;">Periodo</th>
            ${pestTrendHeaders}
          </tr>
          ${pestTrendRows}
        </table>
        ` : ''}

        <!-- Footer -->
        <div style="margin-top:30px;padding-top:15px;border-top:2px solid #e2e8f0;text-align:center;font-size:0.75rem;color:#94a3b8;">
          Reporte generado automáticamente — ${today} — Filtros: ${filterLabel}
        </div>
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
      <html><head><title>Reporte de Métricas</title>
      <style>
        @media print {
          body { margin: 0; }
          @page { margin: 1cm; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; }
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
      <div className="flex flex-wrap gap-4 items-end bg-card p-4 rounded-lg border border-border">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Filtros Activos</label>
          <div className="text-sm p-2 rounded-md border border-border bg-muted/50 min-w-[200px]">
            {filterLabel}
          </div>
        </div>

        <button
          onClick={generatePreview}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md font-medium text-sm hover:opacity-90 transition-all"
        >
          <Eye className="w-4 h-4" />
          Generar Reporte
        </button>

        <button
          onClick={handlePrint}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md font-medium text-sm hover:opacity-90 transition-all"
        >
          <Printer className="w-4 h-4" />
          Imprimir / Guardar como PDF
        </button>
      </div>

      <div className="bg-card rounded-lg border border-border overflow-auto" style={{ maxHeight: 'calc(100vh - 200px)' }}>
        <div ref={reportRef}>
          {reportHtml ? (
            <div dangerouslySetInnerHTML={{ __html: reportHtml }} />
          ) : (
            <div className="text-center text-muted-foreground py-20">
              Haz clic en "Generar Reporte" para crear el reporte con toda la información de métricas según los filtros aplicados.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
