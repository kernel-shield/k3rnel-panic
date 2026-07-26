/* ============================================================
   KERNEL SHIELD — ESQUEMA DE SUPABASE
   Pega TODO este archivo en: tu proyecto de Supabase → SQL Editor →
   "New query" → pega esto → Run.

   Esto crea:
   - Tabla de perfiles (datos extra de cada usuario, incluye is_admin)
   - Tablas de planes, servicios, facturas, tickets y sus mensajes
   - Un trigger que crea el perfil automáticamente cuando alguien
     se registra (Supabase Auth maneja el login/contraseña por ti)
   - Row Level Security (RLS): cada quien solo puede ver/tocar SUS
     propios datos; el admin puede ver y gestionar todo.
============================================================ */

-- ---------- 1. PERFILES ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first text not null,
  last text not null,
  email text not null,
  country text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

-- Crea automáticamente el perfil cuando alguien se registra en Supabase Auth.
-- Los datos first/last/country se mandan como "metadata" desde el frontend
-- al hacer signUp (ver auth.js del sitio).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, first, last, email, country)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'first', 'Cliente'),
    coalesce(new.raw_user_meta_data->>'last', ''),
    new.email,
    new.raw_user_meta_data->>'country'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Evita que un usuario se autoascienda a admin editando su propio perfil
-- desde el navegador (solo tú, desde el SQL Editor, puedes marcar is_admin).
create or replace function public.protect_is_admin()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.role() <> 'service_role' then
    new.is_admin := old.is_admin;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_is_admin_trigger on public.profiles;
create trigger protect_is_admin_trigger
  before update on public.profiles
  for each row execute procedure public.protect_is_admin();

-- ---------- 2. PLANES VPS ----------
create table if not exists public.plans (
  id text primary key,
  tier text not null check (tier in ('essential','premium')),
  name text not null,
  tag text,
  price numeric not null,
  cores int not null,
  ram text not null,
  disk text not null,
  port text not null,
  bw text not null,
  backup boolean not null default false,
  sort_order int not null default 0
);

-- ---------- 3. SERVICIOS (VPS contratados) ----------
create table if not exists public.services (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id text references public.plans(id),
  name text not null,
  spec text not null,
  price numeric not null,
  method text not null check (method in ('paypal','nequi','binance')),
  status text not null default 'pending' check (status in ('pending','active','rejected')),
  reject_reason text,
  date timestamptz not null default now()
);

-- ---------- 4. FACTURAS ----------
create table if not exists public.invoices (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  svc_id text references public.services(id) on delete set null,
  desc text not null,
  amount numeric not null,
  method text not null check (method in ('paypal','nequi','binance')),
  status text not null default 'pending' check (status in ('pending','paid','rejected')),
  date timestamptz not null default now()
);

-- ---------- 5. TICKETS DE SOPORTE ----------
create table if not exists public.tickets (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  subject text not null,
  category text not null default 'Otro',
  status text not null default 'open' check (status in ('open','answered','closed')),
  date timestamptz not null default now()
);

create table if not exists public.ticket_messages (
  id bigint generated always as identity primary key,
  ticket_id text not null references public.tickets(id) on delete cascade,
  from_role text not null check (from_role in ('client','admin')),
  text text not null,
  date timestamptz not null default now()
);

-- ============================================================
-- ROW LEVEL SECURITY — cada quien ve/toca solo lo suyo,
-- excepto el admin (profiles.is_admin = true), que ve todo.
-- ============================================================

alter table public.profiles enable row level security;
alter table public.plans enable row level security;
alter table public.services enable row level security;
alter table public.invoices enable row level security;
alter table public.tickets enable row level security;
alter table public.ticket_messages enable row level security;

-- Helper: ¿el usuario actual es admin?
create or replace function public.is_admin()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

-- ---------- PROFILES ----------
create policy "ver mi perfil o si soy admin ver todos"
  on public.profiles for select
  using (auth.uid() = id or public.is_admin());

create policy "actualizar mi propio perfil"
  on public.profiles for update
  using (auth.uid() = id);

-- ---------- PLANS (lectura pública, escritura solo admin) ----------
create policy "cualquiera puede ver los planes"
  on public.plans for select
  using (true);

create policy "solo admin crea/edita planes"
  on public.plans for insert
  with check (public.is_admin());

create policy "solo admin actualiza planes"
  on public.plans for update
  using (public.is_admin());

create policy "solo admin elimina planes"
  on public.plans for delete
  using (public.is_admin());

-- ---------- SERVICES ----------
create policy "ver mis servicios o todos si soy admin"
  on public.services for select
  using (auth.uid() = user_id or public.is_admin());

create policy "crear mi propio servicio (al ordenar un VPS)"
  on public.services for insert
  with check (auth.uid() = user_id);

create policy "solo admin actualiza servicios (aprobar/rechazar)"
  on public.services for update
  using (public.is_admin());

create policy "solo admin elimina servicios"
  on public.services for delete
  using (public.is_admin());

-- ---------- INVOICES ----------
create policy "ver mis facturas o todas si soy admin"
  on public.invoices for select
  using (auth.uid() = user_id or public.is_admin());

create policy "crear mi propia factura (al ordenar un VPS)"
  on public.invoices for insert
  with check (auth.uid() = user_id);

create policy "solo admin actualiza facturas"
  on public.invoices for update
  using (public.is_admin());

create policy "solo admin elimina facturas"
  on public.invoices for delete
  using (public.is_admin());

-- ---------- TICKETS ----------
create policy "ver mis tickets o todos si soy admin"
  on public.tickets for select
  using (auth.uid() = user_id or public.is_admin());

create policy "crear mi propio ticket"
  on public.tickets for insert
  with check (auth.uid() = user_id);

create policy "actualizar mi ticket (reabrir al responder) o admin"
  on public.tickets for update
  using (auth.uid() = user_id or public.is_admin());

-- ---------- TICKET MESSAGES ----------
create policy "ver mensajes de mis tickets o todos si soy admin"
  on public.ticket_messages for select
  using (
    public.is_admin()
    or exists (select 1 from public.tickets t where t.id = ticket_id and t.user_id = auth.uid())
  );

create policy "escribir mensaje en mi propio ticket o como admin"
  on public.ticket_messages for insert
  with check (
    public.is_admin()
    or exists (select 1 from public.tickets t where t.id = ticket_id and t.user_id = auth.uid() and t.status <> 'closed')
  );

-- ============================================================
-- SEED: planes VPS por defecto (los mismos que ya tenías)
-- ============================================================
insert into public.plans (id, tier, name, tag, price, cores, ram, disk, port, bw, backup, sort_order) values
  ('micro','essential','Micro | Essential',null,4.75,2,'4 GB','50GB SSD','500 Mbps','10TB',false,0),
  ('pro','essential','Pro | Essential','Popular',7.45,4,'8 GB','80GB SSD','800 Mbps','10TB',false,1),
  ('max','essential','Max | Essential',null,14.75,4,'16 GB','120GB SSD','800 Mbps','10TB',false,2),
  ('maxplus','essential','Max+ | Essential',null,21.50,6,'24 GB','160GB SSD','800 Mbps','10TB',false,3),
  ('super','essential','Super | Essential',null,32.75,8,'32 GB','200GB SSD','800 Mbps','10TB',false,4),
  ('mega','essential','Mega | Essential','Máximo rendimiento',48.75,8,'48 GB','250GB SSD','800 Mbps','10TB',false,5),
  ('nano-vs','premium','Nano | Virtual Server',null,8.00,2,'2 GB','30GB','1+ Gbps','Ilimitado',true,0),
  ('micro-vs','premium','Micro | Virtual Server',null,16.00,4,'4 GB','80GB','1+ Gbps','Ilimitado',true,1),
  ('pro-vs','premium','Pro | Virtual Server','Popular',32.00,4,'8 GB','160GB','1+ Gbps','Ilimitado',true,2),
  ('ultra-vs','premium','Ultra | Virtual Server',null,54.00,8,'16 GB','320GB','1+ Gbps','Ilimitado',true,3),
  ('mega-vs','premium','Mega | Virtual Server',null,82.00,8,'24 GB','620GB','1+ Gbps','Ilimitado',true,4),
  ('max-vs','premium','Max | Virtual Server','Máximo rendimiento',110.00,12,'32 GB','980GB SSD','1+ Gbps','Ilimitado',true,5)
on conflict (id) do nothing;
