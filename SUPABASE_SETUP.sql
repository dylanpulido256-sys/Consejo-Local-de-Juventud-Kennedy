-- ============================================================
-- EJECUTA ESTE SCRIPT EN SUPABASE > SQL Editor > New query
-- ============================================================

-- 1. Tabla de perfiles (uno por usuario)
CREATE TABLE perfiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  nombre TEXT NOT NULL,
  cargo TEXT,
  rol TEXT NOT NULL DEFAULT 'consejero', -- consejero | mesa_directiva | secretaria
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Sesiones
CREATE TABLE sesiones (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  numero TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'ordinaria',
  activa BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  cerrada_at TIMESTAMPTZ
);

-- 3. Asistencia
CREATE TABLE asistencia (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sesion_id UUID REFERENCES sesiones(id) ON DELETE CASCADE,
  consejero_id UUID REFERENCES perfiles(id) ON DELETE CASCADE,
  presente BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(sesion_id, consejero_id)
);

-- 4. Cola de palabra
CREATE TABLE cola_palabra (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sesion_id UUID REFERENCES sesiones(id) ON DELETE CASCADE,
  consejero_id UUID REFERENCES perfiles(id) ON DELETE CASCADE,
  atendido BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Mociones
CREATE TABLE mociones (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sesion_id UUID REFERENCES sesiones(id) ON DELETE CASCADE,
  consejero_id UUID REFERENCES perfiles(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  texto TEXT NOT NULL,
  estado TEXT DEFAULT 'pendiente', -- pendiente | aprobado | rechazado
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Agenda / Orden del día
CREATE TABLE agenda (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sesion_id UUID REFERENCES sesiones(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  tipo TEXT,
  orden INT DEFAULT 1,
  estado TEXT DEFAULT 'pendiente', -- pendiente | en_curso | aprobado | rechazado
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Votaciones
CREATE TABLE votaciones (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sesion_id UUID REFERENCES sesiones(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  si INT DEFAULT 0,
  no INT DEFAULT 0,
  abstencion INT DEFAULT 0,
  estado TEXT DEFAULT 'abierta', -- abierta | aprobado | rechazado
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PERMISOS (Row Level Security)
-- ============================================================

ALTER TABLE perfiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE sesiones ENABLE ROW LEVEL SECURITY;
ALTER TABLE asistencia ENABLE ROW LEVEL SECURITY;
ALTER TABLE cola_palabra ENABLE ROW LEVEL SECURITY;
ALTER TABLE mociones ENABLE ROW LEVEL SECURITY;
ALTER TABLE agenda ENABLE ROW LEVEL SECURITY;
ALTER TABLE votaciones ENABLE ROW LEVEL SECURITY;

-- Perfiles: cada usuario ve y edita solo el suyo
CREATE POLICY "Ver perfiles" ON perfiles FOR SELECT USING (true);
CREATE POLICY "Editar propio perfil" ON perfiles FOR UPDATE USING (auth.uid() = id);

-- Sesiones: todos leen, solo autenticados insertan/actualizan
CREATE POLICY "Ver sesiones" ON sesiones FOR SELECT USING (true);
CREATE POLICY "Gestionar sesiones" ON sesiones FOR ALL USING (auth.role() = 'authenticated');

-- Asistencia
CREATE POLICY "Ver asistencia" ON asistencia FOR SELECT USING (true);
CREATE POLICY "Registrar asistencia" ON asistencia FOR INSERT WITH CHECK (auth.uid() = consejero_id);
CREATE POLICY "Actualizar asistencia" ON asistencia FOR UPDATE USING (auth.role() = 'authenticated');

-- Cola de palabra
CREATE POLICY "Ver cola" ON cola_palabra FOR SELECT USING (true);
CREATE POLICY "Pedir palabra" ON cola_palabra FOR INSERT WITH CHECK (auth.uid() = consejero_id);
CREATE POLICY "Gestionar cola" ON cola_palabra FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Retirar de cola" ON cola_palabra FOR DELETE USING (auth.uid() = consejero_id);

-- Mociones
CREATE POLICY "Ver mociones" ON mociones FOR SELECT USING (true);
CREATE POLICY "Crear mocion" ON mociones FOR INSERT WITH CHECK (auth.uid() = consejero_id);
CREATE POLICY "Resolver mocion" ON mociones FOR UPDATE USING (auth.role() = 'authenticated');

-- Agenda
CREATE POLICY "Ver agenda" ON agenda FOR SELECT USING (true);
CREATE POLICY "Gestionar agenda" ON agenda FOR ALL USING (auth.role() = 'authenticated');

-- Votaciones
CREATE POLICY "Ver votaciones" ON votaciones FOR SELECT USING (true);
CREATE POLICY "Gestionar votaciones" ON votaciones FOR ALL USING (auth.role() = 'authenticated');

-- ============================================================
-- TRIGGER: crear perfil automáticamente al registrar usuario
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.perfiles (id, nombre, cargo, rol)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nombre', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'cargo', 'Consejero(a)'),
    COALESCE(NEW.raw_user_meta_data->>'rol', 'consejero')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
