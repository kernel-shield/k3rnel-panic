# Kernel Shield — Backend (API + Base de datos real)

Este servidor reemplaza el `localStorage` del sitio: ahora los usuarios,
servicios, facturas, tickets y planes viven en una base de datos SQLite
real (`kernelshield.db`), y solo tu servidor puede leerla/escribirla.

## 1. Requisitos

- Tener **Node.js** instalado (versión 18 o superior). Descárgalo de
  https://nodejs.org si no lo tienes.

## 2. Instalar las dependencias

Abre una terminal **dentro de esta carpeta** (`ks-server`) y corre:

```
npm install
```

Esto descarga Express, la base de datos, bcrypt, etc. Necesitas internet
para este paso (una sola vez).

## 3. Configurar el archivo `.env`

Este archivo es donde van tus contraseñas y configuraciones secretas —
**nunca lo subas a GitHub ni lo compartas**.

**Paso a paso:**

1. Copia el archivo `.env.example` y renómbralo a `.env` (mismo carpeta).
   - Windows: copia el archivo, pégalo, y renómbralo a `.env`
   - O por terminal: `cp .env.example .env`

2. Abre `.env` con el Bloc de notas y genera el hash de tu contraseña de
   admin corriendo esto en la terminal (dentro de la carpeta `ks-server`):

   ```
   npm run hash-admin-pass
   ```

   Te va a preguntar la contraseña que quieras usar para entrar al panel
   admin (por ejemplo, la misma `kernelshield2026` que ya tenías, o una
   nueva). Te va a imprimir algo como:

   ```
   ADMIN_PASSWORD_HASH=$2a$12$abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIJKLMN
   ```

   Copia esa línea completa y pégala en tu archivo `.env`, reemplazando
   la línea `ADMIN_PASSWORD_HASH=` que ya está ahí vacía.

3. Cambia también la línea `JWT_SECRET=` por cualquier frase larga y
   aleatoria tuya (no tiene que tener sentido, entre más rara mejor).
   Ejemplo:

   ```
   JWT_SECRET=kx92-nfP38dl-ksAppSecreto-2026-noCompartir-xyzXD
   ```

4. Los datos de `PAYPAL_BUSINESS_EMAIL`, `NEQUI_NUMBER` y `BINANCE_UID`
   ya vienen con los que ya usabas — solo revisa que sigan siendo
   correctos.

Tu `.env` final debe verse más o menos así (con TUS valores reales,
no estos de ejemplo):

```
PORT=4000
CORS_ORIGIN=*
JWT_SECRET=kx92-nfP38dl-ksAppSecreto-2026-noCompartir-xyzXD
ADMIN_PASSWORD_HASH=$2a$12$abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIJKLMN
PAYPAL_BUSINESS_EMAIL=saylinv2782@gmail.com
NEQUI_NUMBER=3128482212
BINANCE_UID=1216562025
```

## 4. Arrancar el servidor

```
npm start
```

Si todo salió bien vas a ver en la terminal:

```
✅ Kernel Shield API corriendo en http://localhost:4000
   Base de datos: .../ks-server/kernelshield.db
```

La primera vez que arranca, crea automáticamente el archivo
`kernelshield.db` con las tablas vacías y los planes VPS de ejemplo ya
cargados (los mismos Essential/Premium que ya tenías).

## 5. Verificar que funciona

Abre en el navegador: `http://localhost:4000/api/health`
Deberías ver: `{"ok":true,"service":"kernelshield-server"}`

## ¿Qué sigue?

Este backend ya está listo, pero **el sitio web (los `.html`) todavía
no le habla a esta API** — sigue usando `localStorage`. El siguiente
paso es conectar `core.js`, `panel.js` y `admin.js` para que en vez de
leer/escribir `localStorage`, hagan peticiones (`fetch`) a estas rutas.
Cuando quieras, seguimos con eso.

## Rutas disponibles (referencia rápida)

**Públicas:**
- `GET /api/plans` — lista de planes essential/premium

**Cliente (requiere login, usa cookies de sesión):**
- `POST /api/auth/register` — crear cuenta
- `POST /api/auth/login` — iniciar sesión
- `POST /api/auth/logout` — cerrar sesión
- `GET  /api/auth/me` — datos de la cuenta logueada
- `POST /api/orders` — crear una orden/VPS (queda "pending")
- `GET  /api/orders/mine` — mis servicios y facturas
- `GET  /api/tickets` — mis tickets
- `POST /api/tickets` — crear ticket
- `GET  /api/tickets/:id` — ver hilo de un ticket mío
- `POST /api/tickets/:id/reply` — responder en mi ticket

**Admin (requiere contraseña de admin, cookie de sesión aparte):**
- `POST   /api/admin/login`
- `POST   /api/admin/logout`
- `GET    /api/admin/orders` — todas las órdenes
- `POST   /api/admin/orders/:id/approve`
- `POST   /api/admin/orders/:id/reject`   body: `{ "reason": "..." }`
- `POST   /api/admin/orders/:id/revoke`
- `DELETE /api/admin/orders/:id`
- `GET    /api/admin/tickets`
- `GET    /api/admin/tickets/:id`
- `POST   /api/admin/tickets/:id/reply`   body: `{ "message": "..." }`
- `POST   /api/admin/tickets/:id/close`
- `POST   /api/admin/plans` — crear/editar plan
- `DELETE /api/admin/plans/:id`
