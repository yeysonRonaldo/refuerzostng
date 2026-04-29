
# Proyección & Comparación Mensual

Nuevo apartado en la barra lateral con todas las métricas comparativas mes vs mes anterior, además de proyección del mes actual basada en datos parciales y tendencias multi-mes. Respeta los filtros globales (Año / Mes / Técnico) y el agrupamiento de plagas.

## Acceso

- Nuevo ítem de navegación en `Sidebar.tsx`: **"Proyección Mensual"** con icono `TrendingUp`.
- Nueva vista `MonthlyProjectionView.tsx` cargada con `lazy()` en `src/pages/Index.tsx`.
- Nuevo `TabName`: `'projection'` en `src/types/refuerzos.ts`.

## Selector de período

Arriba de la vista, dos selects:
- **Mes Actual** (default = último mes con datos)
- **Mes de Comparación** (default = mes inmediatamente anterior; editable para comparar contra cualquier mes — útil para year-over-year)

Botón "Intercambiar" para invertir A vs B rápido.

## Sección 1 — KPIs de variación (tarjetas grandes)

Cada tarjeta muestra: valor actual, valor anterior, delta absoluto, delta %, flecha ↑↓ y color (verde si mejora, rojo si empeora). Lógica de "bueno/malo" definida por métrica.

- **Total de refuerzos** (menos = mejor)
- **Casos Alto / Medio / Bajo** (3 tarjetas, menos = mejor)
- **Clientes únicos afectados**
- **Casos nuevos** (clientes+plaga que no existían el mes anterior)
- **Casos solventados** (estaban antes, ya no aparecen)
- **Casos persistentes** (siguen apareciendo igual)
- **Tasa de resolución** = solventados / (persistentes + solventados) %
- **Promedio días activos** del mes
- **Índice de severidad ponderado** = (Alto×3 + Medio×2 + Bajo×1) / total — métrica compuesta para ver si la "carga" se agravó

## Sección 2 — Proyección del mes en curso

Solo visible si "Mes Actual" coincide con el mes calendario en curso.

- Calcula días transcurridos del mes vs días totales.
- Proyección lineal: `proyectado = actual × (díasTotales / díasTranscurridos)`.
- Muestra: "Llevamos X refuerzos al día N de Y → proyección fin de mes: Z (±% vs mes anterior)".
- Barra de progreso visual con marca del valor del mes anterior como referencia.
- Banner de alerta si proyección > mes anterior +10%.

## Sección 3 — Técnicos: mejoraron vs empeoraron

Dos columnas lado a lado:

**Mejoraron** (orden por mayor reducción absoluta)
- Tabla: Técnico · Mes anterior · Mes actual · Δ · Δ%
- Solo técnicos con casos en al menos uno de los dos meses.
- Badge verde ↓.

**Empeoraron** (orden por mayor incremento absoluto)
- Misma tabla, badge rojo ↑.

Casos especiales contemplados:
- Técnico nuevo (0 antes → N ahora): aparece en "empeoraron" marcado como "Nuevo".
- Técnico que desapareció (N antes → 0 ahora): aparece en "mejoraron" marcado como "Sin casos este mes".

Submétrica adicional por técnico: variación de **casos Alto** específicamente (un técnico puede tener mismo total pero más críticos).

## Sección 4 — Plagas: creciendo vs disminuyendo

Dos columnas:

**En crecimiento** — plagas con mayor incremento absoluto y %.
**En disminución** — plagas con mayor reducción.

Cada fila: nombre de plaga · barra horizontal comparativa (anterior vs actual) · Δ · Δ%.

Respeta el toggle de agrupamiento (`isGrouped`) y combina Plagas Internas + Externas usando el mismo `getCombinedPest` que `AnalysisView`.

## Sección 5 — Tendencia multi-mes (gráfica)

Línea de los últimos 6 meses (o todos los disponibles, máx 12) mostrando:
- Total refuerzos
- Casos Alto
- Línea punteada de promedio móvil de 3 meses

SVG inline siguiendo el patrón de `SeverityLineChart`/`PestTrendChart` ya existentes — sin librerías nuevas.

Debajo, mini-tabla con las 5 plagas seleccionadas y su evolución (sparkline por fila).

## Sección 6 — Clientes que empeoraron / mejoraron

Top 10 clientes con mayor incremento de refuerzos (empeoraron) y top 10 con mayor reducción (mejoraron). Click → drill-down a `DatabaseView` filtrado por ese cliente (reusa `handleDrillDown('cliente', nombre)` ya existente).

## Sección 7 — Resumen ejecutivo automático

Bloque tipo `InsightCard` con bullets generados dinámicamente:
- "Los refuerzos bajaron 12% vs mes anterior (320 → 281)"
- "Cucarachas Alemanas crecen por 3er mes consecutivo (+18%)"
- "Técnico Juan Pérez redujo sus casos en 40%"
- "Alerta: 5 clientes nuevos con gravedad Alta"

Reglas heurísticas simples basadas en los deltas calculados arriba.

## Exportación a Excel

Botón "⬇ Excel" arriba a la derecha. Genera `proyeccion-{mesActual}-vs-{mesComparacion}.xlsx` con hojas:

1. **Resumen KPIs** — tabla de las métricas de la Sección 1.
2. **Técnicos** — todas las filas con anterior/actual/Δ/Δ%.
3. **Plagas** — igual.
4. **Clientes** — igual.
5. **Tendencia** — los 12 meses con totales por gravedad.
6. **Proyección** — datos de la sección 2 si aplica.

Usa la librería `xlsx` ya instalada (mismo patrón que `AnalysisView.exportToExcel`).

## Detalles técnicos

- Todos los cálculos en `useMemo`, dependientes de `processedData`, `selectedMonth`, `compareMonth`, `isGrouped`.
- Sin nuevas dependencias — solo `xlsx` y `lucide-react` ya presentes.
- Reutiliza `getCombinedPest` (extraerlo a `src/lib/pestUtils.ts` para compartir con `AnalysisView` y evitar duplicación).
- Respeta filtro de Técnico global: si está activo, las secciones de "Técnicos" se ocultan (no tiene sentido comparar uno solo entre sí).
- Filtro de Año global: si seleccionado, los selectores de mes solo muestran meses de ese año.
- Responsive: grids `grid-cols-1 md:grid-cols-2 lg:grid-cols-4` para KPIs; columnas se apilan en móvil.

## Archivos a crear / modificar

- **Crear** `src/components/refuerzos/MonthlyProjectionView.tsx` (vista principal)
- **Crear** `src/lib/pestUtils.ts` (helper `getCombinedPest`)
- **Modificar** `src/types/refuerzos.ts` — añadir `'projection'` a `TabName`
- **Modificar** `src/components/refuerzos/Sidebar.tsx` — nuevo ítem de nav
- **Modificar** `src/pages/Index.tsx` — `lazy` import + render condicional
- **Modificar** `src/components/refuerzos/AnalysisView.tsx` — usar el nuevo `getCombinedPest` compartido
