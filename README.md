# GeoAds AR

PWA (React + three.js) para esconder publicidad en coordenadas reales, al estilo Pokémon GO.
El cliente camina guiado por la cámara (flecha 3D, faro, radar y pitidos). Al entrar en el rango de captura
(20 m por defecto) aparece un premio 3D con sonido. Al tocarlo se abre una landing 3D con un código de descuento o un video.

- **Base de datos:** Supabase (`supabase/schema.sql`, todas las tablas con prefijo `geo_`). Ahí viven las campañas,
  la analítica, los cupones únicos y los canjes. Los cambios se ven en la app al instante.
- **Admin multiempresa oculto:** está en `https://cashlessmot2026.github.io/target/#/admin`, o tocando el logo 7 veces.
  Se entra con correo y contraseña (Supabase Auth).

## Primer acceso

1. Entra a `#/admin`, pulsa **Regístrate** y confirma tu correo.
2. Inicia sesión y pulsa **Soy el superadministrador**. Este botón solo funciona una vez: el primero que lo pulse se queda con el rol.
3. Crea las empresas. Para dar acceso a cada cliente, pídele que se registre y agrégalo en **Usuarios** con su correo.

## Panel

| Pestaña | Qué hace |
|---|---|
| Campañas | Crear, editar, pausar y eliminar landings: mapa con rango, cupón o video, cupo máximo, fechas, sonido y subida de archivos |
| Estadísticas | Embudo vistas → abrieron AR → llegaron → capturaron → canjearon, por campaña y por día, con exportación a CSV |
| Canjear | El negocio escribe el código del cliente; se valida una sola vez |
| Empresa | Nombre, color y logo |
| Usuarios | (solo super) Dar o quitar acceso por empresa |

Seguridad: las políticas RLS hacen que el público solo vea campañas activas, que cada admin vea únicamente su empresa,
y que los cupones y eventos solo se creen mediante las funciones `geo_claim` y `geo_track`.

## Desarrollo local

```bash
npm install
npm run dev        # http://localhost:5173  (simulador: http://localhost:5173/?sim=1)
npm run build
```

Para probar la cámara y la brújula en un teléfono se necesita HTTPS: usa el sitio de GitHub Pages o un túnel.

## Notas

- La precisión del GPS en exteriores suele ser de 3 a 15 m, por eso el rango mínimo recomendado es de 15 a 20 m.
- En iOS se pide permiso de brújula al tocar «Comenzar exploración».
- El simulador (`?sim=1`) no registra estadísticas ni genera cupones reales.
