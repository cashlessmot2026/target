# GeoAds AR

PWA (React + three.js) para esconder publicidad en coordenadas reales, al estilo Pokémon GO.
El cliente camina guiado por la cámara (flecha 3D, faro, radar y pitidos). Al entrar en el rango de captura
(20 m por defecto) aparece un premio 3D con sonido. Al tocarlo se abre una landing 3D con un código de descuento o un video.

- **Sin login ni backend.** Las campañas viven en `public/campaigns.json` dentro de tu repo de GitHub.
- **Admin multiempresa oculto:** entra en `https://<tu-sitio>/#/admin` o toca el logo 7 veces.
  El admin publica directo al repo con la API de GitHub y GitHub Pages se vuelve a desplegar solo.

## Puesta en marcha (una sola vez)

1. Crea un repositorio en GitHub (por ejemplo `geoads-ar`) y sube esta carpeta:
   ```bash
   git remote add origin https://github.com/<usuario>/geoads-ar.git
   git push -u origin main
   ```
2. En el repo, ve a **Settings → Pages → Source: GitHub Actions**. El workflow `.github/workflows/deploy.yml`
   publica la app en `https://<usuario>.github.io/geoads-ar/`.
3. Crea un token *fine-grained* en **GitHub → Settings → Developer settings → Personal access tokens**:
   - Repository access: solo `geoads-ar`
   - Permissions: **Contents: Read and write**
4. Abre `https://<usuario>.github.io/geoads-ar/#/admin`, ve a la pestaña **GitHub** y llena usuario, repo,
   rama `main`, ruta `public/campaigns.json` y el token. Pulsa **Probar conexión**.

## Uso del admin

- **Empresa:** crea varias empresas (nombre, color de marca, logo). Cada una tiene sus campañas.
- **Campañas:** toca el mapa (o busca una dirección, o usa «📍 Aquí») para fijar las coordenadas y ajusta el rango.
  Elige el tipo de landing (código de descuento o video de YouTube/MP4), el texto, el botón, el sonido opcional y las fechas.
- **Probar en simulador:** abre la app con `?sim=1`, usando tu borrador. Los botones ▲▼ caminan 4 m y ⟲⟳ giran.
- **Publicar:** guarda el JSON en el repo. La app se actualiza en 1–2 minutos, lo que tarda el despliegue.
- Enlace directo por campaña (para QR): `https://<sitio>/#/play/<id>`.

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
- El token de GitHub solo se guarda en el navegador del administrador (localStorage). Usa un token limitado a este repo.
- Si quieres que los cambios se vean al instante, sin esperar el despliegue, define `VITE_DATA_URL` con la URL *raw* del JSON
  (`https://raw.githubusercontent.com/<usuario>/<repo>/main/public/campaigns.json`). Esa URL tiene una caché de unos 5 minutos.
