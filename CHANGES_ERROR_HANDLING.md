# Mejoras en el Manejo de Errores - Guardian.js

## Resumen de Cambios

Se han añadido mejoras significativas en el manejo de errores para proporcionar mensajes más claros y acciones recomendadas cuando algo sale mal.

## Errores Manejados

### 1. Paquete No Encontrado (404)
**Antes:**
```
❌ Failed to fetch metadata for react-invalid
Exit status: 1
```

**Ahora:**
```
❌ Package "react-invalid" not found in npm registry. Please verify the package name is correct.
```

- **Afecta a:** `install`, `update`, `audit`, `use` commands
- **Dónde:** Cuando se intenta buscar un paquete que no existe en npm

### 2. Conflicto de Peer Dependencies Irrecuperable
**Antes:**
```
❌ Command failed even with --legacy-peer-deps: npm install react-chrono@latest
Exit status: 1
```

**Ahora:**
```
⚠️  Peer dependency conflict detected. Retrying with --legacy-peer-deps...
❌ Unresolvable peer dependency conflict. Even with --legacy-peer-deps, this package cannot be installed due to incompatible dependencies.
⚠️  Try adding "react-chrono" to excludeInstall in your guardian config to skip validation.
```

- **Afecta a:** `install`, `update` commands
- **Dónde:** Cuando hay conflictos de dependencias incluso después del reintentos con `--legacy-peer-deps`
- **Solución sugerida:** Añadir el paquete a la lista `excludeInstall` o `excludeUpdate`

### 3. Sin Versiones Válidas por Antigüedad
**Antes:**
```
❌ No versions of lodash are at least 100000 days old
(application exitía con código 1)
```

**Ahora:**
```
❌ No versions of lodash are at least 100000 days old
(application continúa, sin error fatal)
```

- **Cambio:** Ya no causa una salida fatal, permite continuar con otros paquetes

### 4. Versión No Satisface el Rango
**Antes:**
```
❌ No version of react satisfies "99.0.0" and is at least 30 days old
(application exitía con código 1)
```

**Ahora:**
```
❌ No version of react satisfies "99.0.0" and is at least 30 days old
(application continúa, sin error fatal)
```

- **Cambio:** Ya no causa una salida fatal

## Mejoras Técnicas

### En `execCmdSync()`:
- Detecta cuando un error ERESOLVE persiste incluso después del retry con `--legacy-peer-deps`
- Marca el error con `code: "ERESOLVE_UNRESOLVABLE"` para fácil identificación
- Proporciona mensajes de error claros

### En `checkAndInstall()`:
- Captura y maneja errores ERESOLVE_UNRESOLVABLE con mensajes útiles
- Sugiere añadir el paquete a `excludeInstall` como solución
- Ya no usa `process.exit()` para errores recuperables

### En `checkAndUpdate()`:
- Captura y maneja errores ERESOLVE_UNRESOLVABLE con mensajes útiles
- Sugiere añadir el paquete a `excludeUpdate` como solución
- Ya no usa `process.exit()` para errores recuperables

### En `resolveSafeVersion()`:
- Mejora los mensajes de error 404 con sugerencias

## Beneficios

1. **Mejor UX**: Mensajes de error claros y específicos
2. **Soluciones sugeridas**: Cada error incluye un paso recomendado
3. **Graceful handling**: Los errores no son fatales cuando es posible continuar
4. **Mejor debugging**: HTTP status codes incluidos en mensajes de error

## Pruebas Realizadas

```bash
# Paquete no existente
$ guardian install nonexistent-package-12345 --min-age 0
❌ Package "nonexistent-package-12345" not found in npm registry. Please verify the package name is correct.

# Requisito de antigüedad imposible
$ guardian install lodash --min-age 100000
❌ No versions of lodash are at least 100000 days old
```

## Archivos Modificados

- `bin/cli.js`: Mejoras en `execCmdSync()`, `checkAndInstall()`, `checkAndUpdate()`, `resolveSafeVersion()`
- `README.md`: Sección de Troubleshooting mejorada con ejemplos y soluciones

## Compatibilidad

- ✅ No breaking changes
- ✅ Compatible con versiones anteriores del config
- ✅ Mejora la experiencia sin afectar el comportamiento funcional
