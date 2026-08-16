# Consejo Municipal de Juventud — App de Sesiones

## ¿Qué hace esta app?
- Cada consejero inicia sesión con su correo y contraseña
- Registra su asistencia con un botón
- Pide la palabra y ve su posición en la cola
- Envía mociones y proposiciones
- La mesa directiva gestiona la sesión, la cola y la agenda
- La secretaría maneja las votaciones
- El público puede ver el estado en tiempo real sin cuenta

---

## PASO 1 — Crear cuenta en Supabase

1. Ve a https://supabase.com y haz clic en **Start for free**
2. Regístrate con Google o GitHub
3. Haz clic en **New project**
4. Ponle nombre: `consejo-juventud`
5. Elige una contraseña segura (guárdala)
6. Selecciona región: **South America (São Paulo)**
7. Espera ~2 minutos a que se cree

---

## PASO 2 — Crear las tablas en Supabase

1. En tu proyecto de Supabase, ve al menú izquierdo: **SQL Editor**
2. Haz clic en **New query**
3. Copia y pega TODO el contenido del archivo `SUPABASE_SETUP.sql`
4. Haz clic en el botón verde **Run**
5. Debe decir "Success" al final

---

## PASO 3 — Obtener tus claves de Supabase

1. En el menú izquierdo ve a **Project Settings** (ícono de engranaje)
2. Haz clic en **API**
3. Copia:
   - **Project URL** → es tu `VITE_SUPABASE_URL`
   - **anon / public key** → es tu `VITE_SUPABASE_ANON_KEY`

---

## PASO 4 — Subir el código a GitHub

1. Ve a https://github.com y crea una cuenta si no tienes
2. Haz clic en **New repository**
3. Nombre: `consejo-juventud`
4. Haz clic en **Create repository**
5. En la página del repositorio, haz clic en **uploading an existing file**
6. Arrastra TODOS los archivos de esta carpeta (menos node_modules si existe)
7. Haz clic en **Commit changes**

---

## PASO 5 — Publicar en Vercel

1. Ve a https://vercel.com y regístrate con tu cuenta de GitHub
2. Haz clic en **Add New Project**
3. Selecciona el repositorio `consejo-juventud`
4. En la sección **Environment Variables** agrega:
   - Nombre: `VITE_SUPABASE_URL` → Valor: la URL que copiaste
   - Nombre: `VITE_SUPABASE_ANON_KEY` → Valor: la clave que copiaste
5. Haz clic en **Deploy**
6. En ~2 minutos tendrás un link como `consejo-juventud.vercel.app`

---

## PASO 6 — Crear los usuarios (consejeros)

En Supabase, para cada uno de los 23 consejeros:

1. Ve a **Authentication** en el menú izquierdo
2. Haz clic en **Users** → **Invite user** (o **Add user**)
3. Ingresa el correo del consejero
4. Repite para todos

Luego, para asignar el cargo y rol, ve a **Table Editor** → tabla `perfiles` y edita:
- `nombre`: nombre completo
- `cargo`: su cargo en el consejo
- `rol`: `consejero`, `mesa_directiva`, o `secretaria`

---

## Roles del sistema

| Rol | Puede hacer |
|-----|-------------|
| `consejero` | Registrar asistencia, pedir palabra, enviar mociones |
| `mesa_directiva` | Todo lo anterior + gestionar sesión, cola, agenda, mociones |
| `secretaria` | Todo lo anterior + crear y gestionar votaciones |

---

## Compartir con los consejeros

Una vez publicada, comparte el link con todos. En el celular:
1. Abrir el link en Chrome o Safari
2. Tocar los 3 puntos (menú) → **Agregar a pantalla de inicio**
3. La app quedará instalada como ícono en el celular
