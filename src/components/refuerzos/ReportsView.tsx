import { useState, useMemo, useRef } from 'react';
import { useAppContext } from '@/context/AppContext';
import { Eye, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { buildCombinedPest } from '@/lib/pestUtils';

const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const MONTH_NAMES_FULL = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

export default function ReportsView() {
  const { processedData, currentData, metrics, getPestName, yearFilter, monthFilter, techFilter } = useAppContext();
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
    if (currentData.length === 0 || !metrics) {
      setReportHtml('<div style="text-align:center;padding:50px;color:#94a3b8;">No hay datos con los filtros aplicados.</div>');
      return;
    }

    const today = new Date().toLocaleDateString('es-ES');
    const timelineData = Object.values(metrics.timeline).sort((a, b) => a.sortKey.localeCompare(b.sortKey));

    // === Severity Line Chart SVG (smooth, with labels) ===
    const svgW = 900, svgH = 360, pad = { top: 30, right: 30, bottom: 60, left: 55 };
    const chartW = svgW - pad.left - pad.right, chartH = svgH - pad.top - pad.bottom;

    const buildSeverityChart = () => {
      if (timelineData.length === 0) return '<p style="text-align:center;color:#94a3b8;padding:40px;">No hay datos suficientes para graficar.</p>';

      const dataWithTotal = timelineData.map(t => ({ ...t, total: t.alto + t.medio + t.bajo }));
      const maxVal = Math.max(...dataWithTotal.map(d => d.total), 1);
      const yMax = Math.ceil(maxVal * 1.1);

      const single = dataWithTotal.length === 1;
      const stepX = single ? chartW / 2 : chartW / (dataWithTotal.length - 1);
      const getX = (i: number) => single ? pad.left + chartW / 2 : pad.left + i * stepX;
      const getY = (v: number) => pad.top + chartH - (v / yMax) * chartH;

      const smoothPath = (pts: { x: number; y: number }[]) => {
        if (pts.length === 0) return '';
        if (pts.length === 1) return `M ${pts[0].x},${pts[0].y}`;
        let d = `M ${pts[0].x},${pts[0].y}`;
        for (let i = 0; i < pts.length - 1; i++) {
          const p0 = pts[i - 1] || pts[i];
          const p1 = pts[i];
          const p2 = pts[i + 1];
          const p3 = pts[i + 2] || p2;
          const cp1x = p1.x + (p2.x - p0.x) / 6;
          const cp1y = p1.y + (p2.y - p0.y) / 6;
          const cp2x = p2.x - (p3.x - p1.x) / 6;
          const cp2y = p2.y - (p3.y - p1.y) / 6;
          d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
        }
        return d;
      };

      const lines = [
        { prop: 'bajo' as const, color: '#22c55e', label: 'Bajo' },
        { prop: 'medio' as const, color: '#f59e0b', label: 'Medio' },
        { prop: 'alto' as const, color: '#ef4444', label: 'Alto' },
        { prop: 'total' as const, color: '#1e293b', label: 'Total' },
      ];

      const gridLines = Array.from({ length: 6 }, (_, i) => {
        const val = Math.round((yMax / 5) * i);
        const y = getY(val);
        return `<line x1="${pad.left}" y1="${y}" x2="${svgW - pad.right}" y2="${y}" stroke="#e2e8f0" stroke-width="0.5" stroke-dasharray="3 4"/>
                <text x="${pad.left - 8}" y="${y + 3}" text-anchor="end" font-size="10" fill="#94a3b8">${val}</text>`;
      }).join('');

      const linesSvg = lines.map(l => {
        const pts = dataWithTotal.map((d, i) => ({ x: getX(i), y: getY(d[l.prop]) }));
        const path = smoothPath(pts);
        const dots = dataWithTotal.map((d, i) => {
          const v = d[l.prop];
          if (v === 0 && l.prop !== 'total') return '';
          return `<circle cx="${getX(i)}" cy="${getY(v)}" r="3.5" fill="${l.prop === 'total' ? l.color : '#fff'}" stroke="${l.color}" stroke-width="2"/>${v > 0 ? `<text x="${getX(i)}" y="${getY(v) - 9}" text-anchor="middle" font-size="10" font-weight="700" fill="${l.color}">${v}</text>` : ''}`;
        }).join('');
        return `<path d="${path}" fill="none" stroke="${l.color}" stroke-width="${l.prop === 'total' ? 3 : 2}" stroke-linecap="round" stroke-linejoin="round"/>${dots}`;
      }).join('');

      const skipRate = Math.max(1, Math.ceil(dataWithTotal.length / 12));
      const xLabels = dataWithTotal.map((d, i) => {
        if (i % skipRate !== 0 && i !== dataWithTotal.length - 1) return '';
        return `<text x="${getX(i)}" y="${svgH - 20}" text-anchor="middle" font-size="10" fill="#64748b" transform="rotate(-30,${getX(i)},${svgH - 20})">${d.label}</text>`;
      }).join('');

      const legend = lines.map((l, i) =>
        `<g transform="translate(${pad.left + i * 110}, ${svgH - 5})">
          <circle cx="0" cy="-3" r="5" fill="${l.color}"/>
          <text x="10" y="0" font-size="11" fill="#334155" font-weight="500">${l.label}</text>
        </g>`
      ).join('');

      return `<svg width="100%" viewBox="0 0 ${svgW} ${svgH}" xmlns="http://www.w3.org/2000/svg">
        <line x1="${pad.left}" y1="${pad.top + chartH}" x2="${svgW - pad.right}" y2="${pad.top + chartH}" stroke="#cbd5e1"/>
        ${gridLines}
        ${linesSvg}
        ${xLabels}
        ${legend}
      </svg>`;
    };

    const totalRegistros = metrics.total;

    // === Case Flow Table (same logic as CaseFlowTable component) ===
    const buildCaseFlowTable = () => {
      const scoped = processedData.filter(r => {
        if (!r.dateObj) return false;
        if (techFilter !== 'all' && r.tecnico !== techFilter) return false;
        if (yearFilter !== 'all' && r.dateObj.getUTCFullYear().toString() !== yearFilter) return false;
        return true;
      });
      interface MonthData { records: { key: string }[]; keys: Set<string> }
      const byMonth = new Map<string, MonthData>();
      scoped.forEach(r => {
        if (!r.dateObj) return;
        const p = buildCombinedPest(r, getPestName);
        const mk = `${r.dateObj.getUTCFullYear()}-${String(r.dateObj.getUTCMonth() + 1).padStart(2, '0')}`;
        let data = byMonth.get(mk);
        if (!data) { data = { records: [], keys: new Set() }; byMonth.set(mk, data); }
        const ck = (r.idCliente || r.codigoCliente || r.cliente || r._dedupeKey || r.id || 'sin-cliente').trim().toLowerCase();
        const pk = p && p !== '---' ? p : (r.plaga || 'sin-plaga');
        const key = `${ck}|${pk}`.toLowerCase();
        data.records.push({ key });
        data.keys.add(key);
      });
      const sortedKeys = Array.from(byMonth.keys()).sort();
      if (sortedKeys.length === 0) return '';
      const history = new Set<string>();
      const empty: MonthData = { records: [], keys: new Set() };
      const rows = sortedKeys.map(k => {
        const curr = byMonth.get(k)!;
        const [yStr, mStr] = k.split('-');
        const y = parseInt(yStr, 10), m = parseInt(mStr, 10);
        const prevKey = `${m === 1 ? y - 1 : y}-${String(m === 1 ? 12 : m - 1).padStart(2, '0')}`;
        const prev = byMonth.get(prevKey) ?? empty;
        let nuevos = 0, reaparecidos = 0;
        curr.records.forEach(rec => {
          if (prev.keys.has(rec.key)) return;
          if (history.has(rec.key)) reaparecidos++; else nuevos++;
        });
        const entramos = prev.records.length;
        const pendiente = curr.records.length;
        const suma = entramos + nuevos + reaparecidos;
        const cerraron = Math.max(0, suma - pendiente);
        curr.keys.forEach(x => history.add(x));
        return { label: `${MONTH_NAMES[m - 1]} ${y}`, entramos, nuevos, reaparecidos, suma, cerraron, pendiente };
      }).reverse();

      const fmt = (n: number) => n.toLocaleString('es-ES');
      const rowsHtml = rows.map(r => `
        <tr>
          <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;font-weight:600;">${r.label}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:right;color:#64748b;">${fmt(r.entramos)}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:right;color:#0ea5e9;font-weight:600;">${fmt(r.nuevos + r.reaparecidos)}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:600;">${fmt(r.suma)}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:right;color:#22c55e;font-weight:600;">-${fmt(r.cerraron)}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:right;"><span style="display:inline-block;padding:2px 8px;border-radius:6px;background:#dbeafe;color:#1d4ed8;font-weight:700;">${fmt(r.pendiente)}</span></td>
        </tr>
      `).join('');

      return `
        <div style="margin-top:25px;background:#fff;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;page-break-inside:avoid;">
          <div style="padding:14px 18px;border-bottom:1px solid #e2e8f0;">
            <h2 style="margin:0;font-size:1rem;color:#1e293b;">Flujo de Casos por Mes</h2>
            <p style="margin:4px 0 0;font-size:0.75rem;color:#64748b;">El <strong>Pendiente</strong> es el total mensual. <strong>Nuevos + Reaparecidos</strong> son los que ingresaron al flujo este mes.</p>
          </div>
          <table style="width:100%;border-collapse:collapse;font-size:0.8rem;">
            <thead style="background:#f8fafc;">
              <tr style="text-align:left;">
                <th style="padding:10px;color:#64748b;font-weight:600;">Mes</th>
                <th style="padding:10px;color:#64748b;font-weight:600;text-align:right;">Entramos con</th>
                <th style="padding:10px;color:#64748b;font-weight:600;text-align:right;">Nuevos + Reaparecidos</th>
                <th style="padding:10px;color:#64748b;font-weight:600;text-align:right;">A controlar</th>
                <th style="padding:10px;color:#64748b;font-weight:600;text-align:right;">Se cerraron</th>
                <th style="padding:10px;color:#64748b;font-weight:600;text-align:right;">Pendiente</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </div>
      `;
    };


    const html = `
      <div style="font-family:'Segoe UI',system-ui,sans-serif;max-width:1000px;margin:0 auto;padding:30px;">
        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #1e293b;padding-bottom:15px;margin-bottom:25px;">
          <div>
            <h1 style="margin:0;font-size:1.4rem;color:#1e293b;">Evolución de Gravedad</h1>
            <p style="margin:6px 0 0;color:#64748b;font-size:0.85rem;">Filtros: ${filterLabel}</p>
          </div>
          <div style="text-align:right;font-size:0.8rem;color:#64748b;">
            Generado: ${today}<br/>
            Registros: ${totalRegistros.toLocaleString()}
          </div>
        </div>

        <div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:20px;">
          ${buildSeverityChart()}
        </div>

        <div style="margin-top:25px;display:grid;grid-template-columns:repeat(4,1fr);gap:10px;">
          <div style="background:#f8fafc;padding:14px;border-radius:8px;text-align:center;border:1px solid #e2e8f0;">
            <div style="font-size:1.6rem;font-weight:700;color:#1e293b;">${metrics.total.toLocaleString()}</div>
            <div style="font-size:0.75rem;color:#64748b;">Total</div>
          </div>
          <div style="background:#fef2f2;padding:14px;border-radius:8px;text-align:center;border:1px solid #fecaca;">
            <div style="font-size:1.6rem;font-weight:700;color:#ef4444;">${metrics.high.toLocaleString()}</div>
            <div style="font-size:0.75rem;color:#64748b;">Alto</div>
          </div>
          <div style="background:#fffbeb;padding:14px;border-radius:8px;text-align:center;border:1px solid #fde68a;">
            <div style="font-size:1.6rem;font-weight:700;color:#f59e0b;">${metrics.mid.toLocaleString()}</div>
            <div style="font-size:0.75rem;color:#64748b;">Medio</div>
          </div>
          <div style="background:#f0fdf4;padding:14px;border-radius:8px;text-align:center;border:1px solid #bbf7d0;">
            <div style="font-size:1.6rem;font-weight:700;color:#22c55e;">${metrics.low.toLocaleString()}</div>
            <div style="font-size:0.75rem;color:#64748b;">Bajo</div>
          </div>
        </div>

        ${buildCaseFlowTable()}

        <div style="margin-top:30px;padding-top:15px;border-top:2px solid #e2e8f0;text-align:center;font-size:0.75rem;color:#94a3b8;">
          Reporte generado automáticamente — ${today}
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
      <html><head><title>Evolución de Gravedad</title>
      <style>
        @media print {
          body { margin: 0; }
          @page { margin: 1cm; size: landscape; }
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
              Haz clic en "Generar Reporte" para ver la gráfica de Evolución de Gravedad.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
