# Kernel Shield — Setup completo

## Bugs corregidos en esta versión
1. **404 en POST /api/orders** — el backend ahora acepta `plan_id` (el campo que manda el frontend)
2. **package.json** apuntaba a `src/index.js` que no existe — corregido a `index.js`
3. **Columna date/created_at** — `orders/mine` ahora devuelve alias `created_at` para compatibilidad
4. **getPlansDB()** — ahora tiene try/catch y logs claros si la API falla
5. **DATABASE_URL faltaba en .env** — corregido con instrucciones exactas de dónde sacarlo

---

## Paso 1 — Obtener DATABASE_URL de Supabase

1. Ve a https://supabase.com → tu proyecto
2. Sidebar → **Project Settings** → **Database**
3. Sección **Connection string** → elige **URI**
4. Copia el string (formato: `postgresql://postgres:[PASSWORD]@db.xxx.supabase.co:5432/postgres`)
5. Reemplaza `[PASSWORD]` por tu contraseña real de Supabase

## Paso 2 — Configurar .env

```bash
cp .env.example .env
```

Edita `.env` y pon tu `DATABASE_URL` real. El resto ya viene configurado.

## Paso 3 — Instalar dependencias

```bash
npm install
```

## Paso 4 — Arrancar el servidor

```bash
npm start
```

Deberías ver:
```
✅ Kernel Shield API corriendo en http://0.0.0.0:4000
[db] Conectado exitosamente a Supabase PostgreSQL.
[db] Planes por defecto insertados.
```

Verifica: http://localhost:4000/api/health → `{"ok":true,...}`

## Paso 5 — Configurar el frontend

En cada HTML, antes de `<script src="core.js">`, agrega:
```html
<script>window.KS_API_URL = 'http://localhost:4000';</script>
```

En producción (cuando tengas dominio):
```html
<script>window.KS_API_URL = 'https://api.kernelshield.xyz';</script>
```

## Paso 6 — Nginx en tu VPS (producción)

```nginx
server {
    listen 80;
    server_name api.kernelshield.xyz;

    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Después: `certbot --nginx -d api.kernelshield.xyz` para HTTPS.

## Con PM2 (para que el servidor no muera)

```bash
npm install -g pm2
pm2 start index.js --name kernelshield-api
pm2 save
pm2 startup
```
