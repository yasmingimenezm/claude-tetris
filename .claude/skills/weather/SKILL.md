---
name: weather
description: Consulta el clima actual (temperatura, condición, humedad, viento) de una ubicación mediante búsqueda web. Usa esta skill cuando el usuario pida el clima, la temperatura o el estado del tiempo de un lugar. Si no se indica ubicación, usa Sabadell, Barcelona (España) por defecto.
---

# Weather

Consulta el clima actual de una ubicación y lo reporta de forma breve.

## Uso

- `/weather` — consulta el clima de Sabadell, Barcelona (España) (ubicación por defecto).
- `/weather <ubicación>` — consulta el clima de la ubicación indicada (ej. `/weather Madrid`).

## Pasos

1. Determina la ubicación: usa el argumento recibido, o "Sabadell, Barcelona (España)" si no se pasó ninguno.
2. Usa la herramienta WebSearch con una query del tipo `weather <ubicación> now temperature`.
3. Extrae del resultado: temperatura actual, sensación térmica, condición (soleado, nublado, lluvia, etc.), humedad y viento.
4. Responde al usuario en 1-2 líneas con esos datos, e incluye la sección "Sources:" con los enlaces relevantes en formato markdown, tal como exige la herramienta WebSearch.

No inventes datos: si la búsqueda no devuelve una cifra clara, dilo explícitamente en vez de estimar.
