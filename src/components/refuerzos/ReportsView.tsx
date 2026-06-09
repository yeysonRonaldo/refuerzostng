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
