## Diagnóstico

Confirmaste que el Excel usa **formato US: `mm/dd/yyyy`** (mes-día-año).

El parser actual en `src/lib/dataProcessor.ts` hace lo contrario: cuando ambos números son ≤ 12 (caso ambiguo), prioriza **`dd/mm/yyyy`** (formato latino). Resultado:

- `04/01/2026` (1 de abril en US) → se interpreta como **1 de enero** ❌
- `04/02/2026` (2 de abril) → **2 de febrero** ❌
- `04/03/2026` (3 de abril) → **3 de marzo** ❌
- `04/15/2026` (15 de abril) → **15 de abril** ✅ (porque 15 > 12, desambigua solo)

Por eso abril muestra **378** en lugar de **382**: los registros con día ≤ 12 caen en otros meses (enero, febrero, marzo). No hay filas sin fecha; hay filas con fecha **mal asignada** a otro mes.

Además, **estos errores ya están guardados en Firestore** con `dateTimestamp` incorrecto, así que cambiar el parser solo no alcanza: hay que reparsear los datos existentes en `/refuezo/public/data`.

## Cambios

### 1. `src/lib/dataProcessor.ts` — invertir la prioridad del parser

Cuando ambos números son ≤ 12, asumir **`mm/dd/yyyy`** primero (formato US del archivo del usuario). Mantener fallback al formato latino solo si el primero falla, para no romper imports anteriores.

```ts
const candidates = first > 12
  ? [{ day: first, month: second - 1 }]              // dd/mm forzado (first > 12)
  : second > 12
    ? [{ day: second, month: first - 1 }]            // mm/dd forzado (second > 12)
    : [{ day: second, month: first - 1 },            // ambiguo: mm/dd PRIMERO (US)
       { day: first, month: second - 1 }];           // fallback dd/mm
```

### 2. Reparseo de los datos ya guardados en Firestore

Como las fechas malas ya están persistidas, agregar un botón **"Reparsear fechas"** en `src/components/refuerzos/DatabaseView.tsx` que:

1. Lea cada documento en `/refuezo/public/data`.
2. Tome `displayDate` (el string original ya formateado como `dd MMM yyyy`) **o** `originalData['Fecha del Último Servicio']` (el string crudo del Excel guardado en cada doc).
3. Vuelva a correr el parser nuevo.
4. Si el `dateTimestamp` resultante difiere del actual, lo actualice junto con `displayDate` y `anio`.
5. Muestre cuántos registros se corrigieron.

Esto evita tener que borrar y re-subir el Excel.

### 3. Nueva función en `src/lib/firestoreService.ts`

`reparseAllDates()`: itera todos los docs, reparsea con el parser nuevo desde `originalData['Fecha del Último Servicio']`, y hace batch updates de los que cambien. Devuelve `{ scanned, updated }`.

## Resultado esperado

- Después de aplicar cambios: tocás **"Reparsear fechas"** una sola vez.
- Abril 2026 debería pasar de **378 → 382**.
- Los meses adyacentes (enero, febrero, marzo) deberían **bajar** acordemente (los registros migran al mes correcto).
- No hace falta borrar ni re-subir.

## Nota sobre la credencial subida

El JSON de Firebase Admin SDK que adjuntaste **no debe quedar en el código** (es una credencial privada de servicio). El reparseo se hará desde el cliente usando la sesión de Firebase Auth ya existente, así que no se usa esa credencial. Te recomiendo **rotarla** en la consola de Google Cloud por las dudas, ya que quedó expuesta en el chat.
