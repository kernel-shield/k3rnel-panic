/* ============================================================
   PARTE 2 — Seguridad extra para servicios (correr DESPUÉS del
   supabase-schema.sql principal). Pega esto también en el SQL
   Editor y dale Run.

   Por qué: sin esto, aunque el usuario solo pueda insertar SUS
   propios servicios, técnicamente podría mandar un precio inventado
   desde las herramientas de desarrollador del navegador. Este
   trigger IGNORA lo que mande el navegador para price/name/spec y
   los reemplaza siempre por los datos reales del plan en la base
   de datos — igual que ya hacía el backend Node.js que armamos
   antes, pero ahora a nivel de base de datos.
============================================================ */
create or replace function public.enforce_service_price()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  p record;
begin
  select * into p from public.plans where id = new.plan_id;
  if p is null then
    raise exception 'Plan % no existe', new.plan_id;
  end if;
  new.name := 'VPS ' || p.name;
  new.spec := p.cores || ' vCores · ' || p.ram || ' RAM · ' || p.disk;
  new.price := p.price;
  new.status := 'pending';
  new.reject_reason := null;
  return new;
end;
$$;

drop trigger if exists enforce_service_price_trigger on public.services;
create trigger enforce_service_price_trigger
  before insert on public.services
  for each row execute procedure public.enforce_service_price();

-- Lo mismo para la factura: el monto sale siempre del plan, no de lo
-- que mande el navegador.
create or replace function public.enforce_invoice_amount()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  s record;
begin
  select * into s from public.services where id = new.svc_id;
  if s is null then
    raise exception 'Servicio % no existe', new.svc_id;
  end if;
  new.amount := s.price;
  new.desc := s.name;
  new.status := 'pending';
  return new;
end;
$$;

drop trigger if exists enforce_invoice_amount_trigger on public.invoices;
create trigger enforce_invoice_amount_trigger
  before insert on public.invoices
  for each row execute procedure public.enforce_invoice_amount();
