import { useState, useMemo, useRef } from 'react';
import { useAppContext, PEST_COLORS } from '@/context/AppContext';
import { computeClientGroupFull } from '@/lib/clientGroups';
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

    // === SVG Chart Generators ===
    const svgW = 750, svgH = 250, pad = { top: 20, right: 30, bottom: 50, left: 50 };
    const chartW = svgW - pad.left - pad.right, chartH = svgH - pad.top - pad.bottom;

    // Severity Line Chart SVG
    const buildSeverityChart = () => {
      if (timelineData.length < 2) return '';
      const maxVal = Math.max(...timelineData.map(t => t.alto + t.medio + t.bajo), 1);
      const stepX = chartW / Math.max(timelineData.length - 1, 1);
      const getX = (i: number) => pad.left + i * stepX;
      const getY = (v: number) => pad.top + chartH - (v / maxVal) * chartH;

      const makeLine = (getData: (t: typeof timelineData[0]) => number, color: string) => {
        const pts = timelineData.map((t, i) => `${getX(i)},${getY(getData(t))}`).join(' ');
        const dots = timelineData.map((t, i) => {
          const val = getData(t);
          return `<circle cx="${getX(i)}" cy="${getY(val)}" r="3" fill="${color}"/>${val > 0 ? `<text x="${getX(i)}" y="${getY(val) - 8}" text-anchor="middle" font-size="9" fill="${color}">${val}</text>` : ''}`;
        }).join('');
        return `<polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2"/>${dots}`;
      };

      const xLabels = timelineData.map((t, i) => {
        const skip = Math.ceil(timelineData.length / 12);
        if (i % skip !== 0 && i !== timelineData.length - 1) return '';
        return `<text x="${getX(i)}" y="${svgH - 5}" text-anchor="middle" font-size="9" fill="#64748b" transform="rotate(-35,${getX(i)},${svgH - 10})">${t.label}</text>`;
      }).join('');

      const gridLines = Array.from({ length: 5 }, (_, i) => {
        const val = Math.round((maxVal / 4) * i);
        const y = getY(val);
        return `<line x1="${pad.left}" y1="${y}" x2="${svgW - pad.right}" y2="${y}" stroke="#e2e8f0" stroke-width="0.5"/>
                <text x="${pad.left - 5}" y="${y + 3}" text-anchor="end" font-size="9" fill="#94a3b8">${val}</text>`;
      }).join('');

      return `<svg width="100%" viewBox="0 0 ${svgW} ${svgH}" style="margin-bottom:10px;">
        ${gridLines}
        ${makeLine(t => t.bajo, '#22c55e')}
        ${makeLine(t => t.medio, '#f59e0b')}
        ${makeLine(t => t.alto, '#ef4444')}
        ${makeLine(t => t.alto + t.medio + t.bajo, '#1e293b')}
        ${xLabels}
        <text x="${svgW - 10}" y="${pad.top - 5}" text-anchor="end" font-size="9">
          <tspan fill="#ef4444">■ Alto</tspan>  <tspan fill="#f59e0b">■ Medio</tspan>  <tspan fill="#22c55e">■ Bajo</tspan>  <tspan fill="#1e293b">■ Total</tspan>
        </text>
      </svg>`;
    };

    // Pest Trend Line Chart SVG
    const buildPestTrendChart = () => {
      if (pestTrendData.length < 2 || selectedPests.length === 0) return '';
      const maxVal = Math.max(...pestTrendData.flatMap(pt => selectedPests.map(p => pt.counts[p] || 0)), 1);
      const stepX = chartW / Math.max(pestTrendData.length - 1, 1);
      const getX = (i: number) => pad.left + i * stepX;
      const getY = (v: number) => pad.top + chartH - (v / maxVal) * chartH;

      const lines = selectedPests.map((pest, pi) => {
        const color = PEST_COLORS[pi % PEST_COLORS.length];
        const pts = pestTrendData.map((pt, i) => `${getX(i)},${getY(pt.counts[pest] || 0)}`).join(' ');
        const dots = pestTrendData.map((pt, i) => {
          const val = pt.counts[pest] || 0;
          return val > 0 ? `<circle cx="${getX(i)}" cy="${getY(val)}" r="3" fill="${color}"/>` : '';
        }).join('');
        return `<polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2"/>${dots}`;
      }).join('');

      const xLabels = pestTrendData.map((pt, i) => {
        const skip = Math.ceil(pestTrendData.length / 12);
        if (i % skip !== 0 && i !== pestTrendData.length - 1) return '';
        return `<text x="${getX(i)}" y="${svgH - 5}" text-anchor="middle" font-size="9" fill="#64748b" transform="rotate(-35,${getX(i)},${svgH - 10})">${pt.label}</text>`;
      }).join('');

      const legend = selectedPests.map((p, i) =>
        `<tspan fill="${PEST_COLORS[i % PEST_COLORS.length]}">■ ${p}</tspan>  `
      ).join('');

      return `<svg width="100%" viewBox="0 0 ${svgW} ${svgH}" style="margin-bottom:10px;">
        ${lines}
        ${xLabels}
        <text x="${pad.left}" y="${pad.top - 5}" font-size="9">${legend}</text>
      </svg>`;
    };

    // Horizontal Bar Chart SVG
    const buildBarChart = (title: string, data: [string, number][], color: string) => {
      if (data.length === 0) return '';
      const maxVal = Math.max(...data.map(d => d[1]), 1);
      const barH = 22, gap = 4, labelW = 180;
      const totalH = data.length * (barH + gap) + 30;
      const barArea = svgW - labelW - 60;

      const bars = data.map(([label, val], i) => {
        const y = 25 + i * (barH + gap);
        const w = (val / maxVal) * barArea;
        const displayLabel = label.length > 25 ? label.substring(0, 22) + '...' : label;
        return `<text x="${labelW - 5}" y="${y + 15}" text-anchor="end" font-size="10" fill="#334155">${displayLabel}</text>
                <rect x="${labelW}" y="${y}" width="${w}" height="${barH}" rx="3" fill="${color}" opacity="0.8"/>
                <text x="${labelW + w + 5}" y="${y + 15}" font-size="10" fill="#334155" font-weight="600">${val}</text>`;
      }).join('');

      return `<div style="margin-bottom:15px;">
        <h3 style="font-size:0.9rem;color:#1e293b;margin-bottom:5px;">${title}</h3>
        <svg width="100%" viewBox="0 0 ${svgW} ${totalH}">${bars}</svg>
      </div>`;
    };

    // Donut chart for severity distribution
    const buildDonutChart = () => {
      const total = metrics.high + metrics.mid + metrics.low;
      if (total === 0) return '';
      const cx = 90, cy = 90, r = 70, r2 = 45;
      const segments = [
        { val: metrics.high, color: '#ef4444', label: 'Alto' },
        { val: metrics.mid, color: '#f59e0b', label: 'Medio' },
        { val: metrics.low, color: '#22c55e', label: 'Bajo' },
      ];
      let startAngle = -90;
      const paths = segments.map(seg => {
        const angle = (seg.val / total) * 360;
        const endAngle = startAngle + angle;
        const largeArc = angle > 180 ? 1 : 0;
        const x1 = cx + r * Math.cos((startAngle * Math.PI) / 180);
        const y1 = cy + r * Math.sin((startAngle * Math.PI) / 180);
        const x2 = cx + r * Math.cos((endAngle * Math.PI) / 180);
        const y2 = cy + r * Math.sin((endAngle * Math.PI) / 180);
        const ix1 = cx + r2 * Math.cos((endAngle * Math.PI) / 180);
        const iy1 = cy + r2 * Math.sin((endAngle * Math.PI) / 180);
        const ix2 = cx + r2 * Math.cos((startAngle * Math.PI) / 180);
        const iy2 = cy + r2 * Math.sin((startAngle * Math.PI) / 180);
        const path = `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} L ${ix1} ${iy1} A ${r2} ${r2} 0 ${largeArc} 0 ${ix2} ${iy2} Z`;
        startAngle = endAngle;
        return `<path d="${path}" fill="${seg.color}"/>`;
      }).join('');

      const legendItems = segments.map((s, i) =>
        `<text x="200" y="${55 + i * 25}" font-size="12" fill="#334155"><tspan fill="${s.color}" font-size="14">●</tspan> ${s.label}: ${s.val} (${((s.val / total) * 100).toFixed(1)}%)</text>`
      ).join('');

      return `<svg width="350" height="180" viewBox="0 0 350 180">
        ${paths}
        <text x="${cx}" y="${cy + 4}" text-anchor="middle" font-size="16" font-weight="700" fill="#1e293b">${total}</text>
        ${legendItems}
      </svg>`;
    };

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

        <!-- Severity Donut -->
        <div style="text-align:center;margin-bottom:20px;">
          ${buildDonutChart()}
        </div>

        <!-- Client Group Summary -->
        ${(() => {
          const groups = computeClientGroupFull(currentData).filter(g => g.total > 0);
          if (groups.length === 0) return '';
          return `
            <h2 style="font-size:1rem;color:#1e293b;border-bottom:1px solid #e2e8f0;padding-bottom:8px;">Resumen por Grupo de Cliente</h2>
            ${groups.map(g => `
              <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px;margin-bottom:15px;">
                <div style="font-weight:700;font-size:0.95rem;margin-bottom:10px;color:#1e293b;">${g.name}</div>
                <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;text-align:center;margin-bottom:12px;">
                  <div><div style="font-size:1.3rem;font-weight:700;color:#ef4444;">${g.alto}</div><div style="font-size:0.65rem;color:#64748b;">Alto</div></div>
                  <div><div style="font-size:1.3rem;font-weight:700;color:#f59e0b;">${g.medio}</div><div style="font-size:0.65rem;color:#64748b;">Medio</div></div>
                  <div><div style="font-size:1.3rem;font-weight:700;color:#22c55e;">${g.bajo}</div><div style="font-size:0.65rem;color:#64748b;">Bajo</div></div>
                  <div><div style="font-size:1.3rem;font-weight:700;color:#1e293b;">${g.total}</div><div style="font-size:0.65rem;color:#64748b;">Total</div></div>
                </div>
                ${g.monthly.length > 0 ? `
                <table style="width:100%;border-collapse:collapse;font-size:0.8rem;">
                  <tr style="background:#f1f5f9;">
                    <th style="padding:6px;text-align:left;">Mes</th>
                    <th style="padding:6px;text-align:center;color:#ef4444;">Alto</th>
                    <th style="padding:6px;text-align:center;color:#f59e0b;">Medio</th>
                    <th style="padding:6px;text-align:center;color:#22c55e;">Bajo</th>
                    <th style="padding:6px;text-align:center;">Total</th>
                  </tr>
                  ${g.monthly.map(m => `
                    <tr style="border-bottom:1px solid #f1f5f9;">
                      <td style="padding:6px;">${m.label}</td>
                      <td style="padding:6px;text-align:center;font-weight:600;color:#ef4444;">${m.alto}</td>
                      <td style="padding:6px;text-align:center;font-weight:600;color:#f59e0b;">${m.medio}</td>
                      <td style="padding:6px;text-align:center;font-weight:600;color:#22c55e;">${m.bajo}</td>
                      <td style="padding:6px;text-align:center;font-weight:700;">${m.total}</td>
                    </tr>
                  `).join('')}
                </table>
                ` : ''}
              </div>
            `).join('')}
          `;
        })()}

        <!-- Severity Line Chart -->
        ${timelineData.length >= 2 ? `
        <h2 style="font-size:1rem;color:#1e293b;border-bottom:1px solid #e2e8f0;padding-bottom:8px;">Gráfica: Línea de Tiempo por Gravedad</h2>
        <div style="margin-bottom:20px;">${buildSeverityChart()}</div>
        ` : ''}

        <!-- Pest Trend Chart -->
        ${pestTrendData.length >= 2 && selectedPests.length > 0 ? `
        <h2 style="font-size:1rem;color:#1e293b;border-bottom:1px solid #e2e8f0;padding-bottom:8px;">Gráfica: Tendencia por Plaga</h2>
        <div style="margin-bottom:20px;">${buildPestTrendChart()}</div>
        ` : ''}

        <!-- Bar Charts -->
        <h2 style="font-size:1rem;color:#1e293b;border-bottom:1px solid #e2e8f0;padding-bottom:8px;">Gráficas de Distribución</h2>
        ${buildBarChart('Top Clientes Recurrentes', topClients, '#3b82f6')}
        ${buildBarChart('Top Plagas', topPests, '#8b5cf6')}
        ${buildBarChart('Técnicos con Más Servicios', topTechs, '#0ea5e9')}

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
