# Seguridad Primavera — interfaz

![stack: HTML5](https://img.shields.io/badge/stack--HTML5-0d9488?style=flat-square) ![stack: CSS3](https://img.shields.io/badge/stack--CSS3-0d9488?style=flat-square) ![stack: JavaScript](https://img.shields.io/badge/stack--JavaScript-0d9488?style=flat-square) ![stack: Web App Manifest](https://img.shields.io/badge/stack--Web%20App%20Manifest-0d9488?style=flat-square) ![IA: asistido](https://img.shields.io/badge/IA--asistido-6366f1?style=flat-square) [![Demo](https://img.shields.io/badge/demo-en%20vivo-22c55e?style=flat-square)](https://luisf2020.github.io/secure2/)

Interfaz de gestion de seguridad residencial que funciona en el navegador y guarda los datos localmente, sin backend.

**Tipo:** Aplicacion web estatica (PWA) · **Complejidad:** Intermedio

## Problema que resuelve

Probar una interfaz de gestion (residentes, visitas, incidentes) sin depender de un servidor ni de una base de datos.

## Solucion implementada

Aplicacion de una sola pagina con estado persistido en localStorage, manifest de PWA y renderizado por secciones.

### Funcionalidades principales

- Estado persistido en localStorage
- Manifest instalable (PWA)
- Navegacion por secciones sin recargar
- Diseno responsive en tema oscuro

## Stack

- HTML5
- CSS3
- JavaScript
- Web App Manifest

## Estructura

```
index.html      # interfaz
app.js          # logica y persistencia
manifest.json   # PWA
styles.css
```

## Puesta en marcha

```bash
# Abrir index.html o servirlo con:
python3 -m http.server 8000
```

## Complejidad del proyecto

**Nivel: Intermedio** — Estado propio, persistencia local y comportamiento instalable; sin backend.

El nivel describe la complejidad tecnica del proyecto, no el grado de dominio de quien lo escribio.

## Despliegue

Demo en vivo: <https://luisf2020.github.io/secure2/>  
Publicado con GitHub Pages (rama `gh-pages`).

## Transparencia sobre IA

Este proyecto se desarrollo con asistencia de inteligencia artificial (generacion de codigo,
revision y documentacion). El codigo fue leido, ejecutado y probado manualmente. No se declaran
clientes, metricas ni resultados que no puedan verificarse.

## Autor

**Luis Felipe Zuniga Leon** — Desarrollador de software asistido por IA

- GitHub: <https://github.com/Luisf2020>

---

_Proyecto de portafolio. El desarrollo se apoyo en herramientas de IA bajo revision tecnica humana._
