

# Plan: Auditoría completa, mejora visual y refactor lógico

Voy a hacer una pasada profunda al sistema completo: arreglar fallas lógicas detectadas, modernizar la interfaz a un estilo más limpio y profesional, y mejorar el flujo de guardado en Firebase.

---

## 1. Fallas lógicas detectadas y arreglos

### a) Subida a Firebase sin deduplicación real (crítico)
- **Problema**: `uploadToFirestore` sube TODOS los registros del Excel sin chequear el `_dedupeKey` existente. Si el usuario sube dos veces el mismo archivo, la base se duplica (de 1,578 → 3,156).
- **Arreglo**: usar el `dedupeKeyCache` ya existente para filtrar duplicados antes de subir. Mostrar un resumen real `uploaded / skipped`.

### b) Filtro por mes/año excluye registros sin fecha de forma silenciosa
- **Problema**: el filtro deja pasar registros sin `dateObj` (`!d.dateObj || …`), pero el filtro por año en realidad debería excluirlos cuando el usuario elige un año específico. Hoy aparecen en TODOS los años.
- **Arreglo**: cuando el usuario filtra por año/mes específico, los registros sin fecha se EXCLUYEN. Cuando es "Todos", se incluyen.

### c) Diferencia entre "Total Filtrado" y "Total Plagas"
- **Problema**: ya documentado. Se mostrará un pequeño indicador "X registros sin fecha (no aparecen en gráficas temporales)" en el InsightCard para transparencia.

### d) `id` no es estable (se regenera en cada `splitMultiTechRecords`)
- **Problema**: `RoutesView` usa `item.id` como clave de selección, pero ese ID se reescribe cada vez que cambia `currentData`. Resultado: la selección de rutas se rompe al cambiar filtros.
- **Arreglo**: usar `_dedupeKey + tecnico` como clave estable.

### e) Auto-load no se reintenta si falla
- **Problema**: si Firestore falla en el primer load, queda vacío para siempre (la condición `processedData.length === 0` ya no aplica si el usuario sube algo).
- **Arreglo**: añadir botón "Reintentar" visible cuando hay error y mover el auto-load al `AppProvider` (no al Sidebar) para que sea independiente de la UI.

### f) `EditableCell` pierde foco al re-render
- **Problema menor**: al editar una celda y guardar, otras filas con el mismo cliente se re-renderizan. Funciona pero parpadea.
- **Arreglo**: memo del row.

### g) `splitMultiTechRecords` usa `/` como separador → divide nombres con `/` legítimos
- **Problema**: nombres como "JC/MR" se interpretan como dos técnicos cuando podrían ser iniciales de uno. Mantener el comportamiento pero documentar.

### h) Función `ensureDedupeCache` declarada pero nunca usada
- **Arreglo**: integrarla en `uploadToFirestore` (resuelve el punto a).

---

## 2. Mejoras visuales (estilo más moderno, limpio y elegante)

### a) Sistema de diseño (paleta y tipografía)
Refinar `index.css`:
- Paleta más sofisticada: fondos en `slate` muy sutiles, primario en azul más profundo (`221 83% 53%`), bordes con menos contraste.
- Sombras suaves multinivel (`shadow-sm` → `shadow-elegant`).
- Radius ligeramente mayor (`0.625rem`) para sensación más moderna.
- Variables nuevas: `--surface`, `--surface-elevated`, `--ring-glow`.
- Animaciones globales: `fade-in-up` para tarjetas.

### b) Header
- Look glassmorphism sutil (backdrop-blur).
- Mostrar fecha actual y total filtrado en chip más elegante con ícono.
- Avatar del usuario a la derecha.

### c) Sidebar
- Reorganización en secciones colapsables con íconos secundarios.
- Botón de carga de archivo rediseñado: zona de drag-and-drop visual.
- Filtros con `Select` de shadcn (mejor look móvil).
- Indicador visual de "datos cargados" (badge verde con conteo).
- Separadores sutiles entre secciones.

### d) MetricsView
- Reordenar grid: KPIs (4 cards) en fila superior con íconos + variación %, luego InsightCard ancho completo, luego gráficas grandes y al final los BarCharts.
- Cards con micro-animaciones al hover (lift + glow).
- StatsCards: agregar ícono y mini-sparkline opcional.

### e) Gráficas (SVG)
- Líneas más suaves (curva Catmull-Rom ya implícita con strokeLinejoin=round, mejorar con path bezier).
- Gradientes sutiles bajo la línea total.
- Tooltips reales en hover (no solo `<title>` nativo): pequeño tooltip flotante.
- Etiquetas de eje con tipografía mejorada.

### f) DatabaseView
- Header sticky con sombra al scroll.
- Filtros por columna con ícono de búsqueda.
- Filas con hover más visible y zebra muy sutil.
- Badge de gravedad redondeado tipo "pill".
- Paginación con botones más compactos y selector "filas por página".

### g) RoutesView
- Tarjetas de cliente más limpias (sin múltiples colores).
- Botones de acción agrupados en footer con jerarquía clara (primario/secundario).

### h) Toaster
- Sustituir emojis (✅ ❌) por íconos de Lucide en los `toast.success / error`.

---

## 3. Mejoras de guardado (Firebase)

- **Deduplicación real** en upload (ver punto 1.a).
- **Optimistic updates** en `updateRecordField`: ya funciona, pero añadir rollback si Firestore falla + toast de error.
- **Indicador de sincronización**: badge en el header que muestra "Guardando…" / "Guardado" / "Error" cuando hay updates pendientes.
- **Auto-load resiliente**: mover lógica al `AppProvider`, con botón de reintento visible si falla.

---

## 4. Archivos a modificar

| Archivo | Cambio |
|---|---|
| `src/index.css` | Nueva paleta, sombras, animaciones |
| `src/lib/firestoreService.ts` | Dedup real en upload, mejor manejo de errores |
| `src/context/AppContext.tsx` | Auto-load, fix filtros, sync status |
| `src/components/refuerzos/Header.tsx` | Glassmorphism, sync indicator, avatar |
| `src/components/refuerzos/Sidebar.tsx` | Drag-drop file, secciones, badges |
| `src/components/refuerzos/MetricsView.tsx` | Reorden de grid, layout limpio |
| `src/components/refuerzos/StatsCards.tsx` | Íconos, variación % vs periodo |
| `src/components/refuerzos/InsightCard.tsx` | Mostrar registros sin fecha |
| `src/components/refuerzos/PestTrendChart.tsx` | Curvas suaves, tooltip flotante |
| `src/components/refuerzos/SeverityLineChart.tsx` | Gradiente bajo línea total |
| `src/components/refuerzos/BarChart.tsx` | Estilo más limpio, hover mejor |
| `src/components/refuerzos/DatabaseView.tsx` | Header sticky con sombra, pills, pagination mejorada |
| `src/components/refuerzos/RoutesView.tsx` | Fix key estable, look limpio |
| `src/pages/Index.tsx` | Pasar status sync al header |

---

## 5. Lo que NO voy a tocar

- Lógica de cálculo de métricas (ya está validada y coincide con el Excel original).
- Estructura de datos en Firestore (sigue compatible con datos existentes).
- Reglas de roles/admin.
- Reportes PDF y Reportes Técnicos (funcionan bien, solo refresh visual mínimo si entra dentro del tiempo).

---

## 6. Resultado esperado

- Subir el mismo Excel dos veces NO duplica registros.
- Filtros por año/mes muestran totales coherentes.
- Selección de rutas se mantiene al cambiar filtros.
- UI con look moderno, espacios limpios, animaciones sutiles.
- Indicadores claros de sincronización con Firebase.
- Sin cambios en los conteos actuales (siguen matching el Excel).

