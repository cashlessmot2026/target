-- =====================================================================
-- GeoAds AR · esquema Supabase
-- Solo AGREGA objetos con prefijo geo_ (no modifica tablas existentes).
-- Se ejecuta en una sola transacción: si algo falla, no queda nada a medias.
-- =====================================================================
begin;

-- ---------- Tablas ----------
create table if not exists public.geo_companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color text not null default '#00e5ff',
  logo text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.geo_campaigns (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.geo_companies(id) on delete cascade,
  title text not null default 'Nueva campaña',
  subtitle text not null default '',
  type text not null default 'coupon' check (type in ('coupon', 'video')),
  discount text not null default '',
  code text not null default '',
  coupon_mode text not null default 'unique' check (coupon_mode in ('shared', 'unique')),
  max_claims int check (max_claims is null or max_claims > 0),
  description text not null default '',
  video_url text not null default '',
  cta_text text not null default 'Ver más',
  cta_url text not null default '',
  sound_url text not null default '',
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  radius int not null default 20 check (radius between 5 and 1000),
  active boolean not null default true,
  starts_at date,
  ends_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists geo_campaigns_company_idx on public.geo_campaigns (company_id);

-- Administradores: 'super' ve todo; 'company' solo su empresa
create table if not exists public.geo_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null check (role in ('super', 'company')),
  company_id uuid references public.geo_companies(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (role = 'super' or company_id is not null)
);

-- Premios capturados (un registro por dispositivo y campaña; code = folio único para canjear)
create table if not exists public.geo_claims (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.geo_campaigns(id) on delete cascade,
  company_id uuid not null references public.geo_companies(id) on delete cascade,
  device_id text not null,
  code text not null,
  status text not null default 'claimed' check (status in ('claimed', 'redeemed')),
  claimed_at timestamptz not null default now(),
  redeemed_at timestamptz,
  redeemed_by uuid references auth.users(id) on delete set null,
  unique (campaign_id, device_id)
);
create unique index if not exists geo_claims_code_idx on public.geo_claims (upper(code));
create index if not exists geo_claims_company_idx on public.geo_claims (company_id, claimed_at desc);

-- Analítica: embudo impresión → apertura → llegada → captura → reclamo → canje
create table if not exists public.geo_events (
  id bigint generated always as identity primary key,
  campaign_id uuid not null references public.geo_campaigns(id) on delete cascade,
  company_id uuid not null references public.geo_companies(id) on delete cascade,
  device_id text not null,
  type text not null check (type in ('impression', 'open', 'arrive', 'capture', 'claim', 'cta', 'video', 'redeem')),
  distance_m real,
  created_at timestamptz not null default now()
);
create index if not exists geo_events_company_idx on public.geo_events (company_id, created_at);
create index if not exists geo_events_campaign_idx on public.geo_events (campaign_id, type);

-- ---------- Helpers de permisos ----------
create or replace function public.geo_is_super() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from geo_admins where user_id = auth.uid() and role = 'super')
$$;

create or replace function public.geo_can_manage(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from geo_admins
    where user_id = auth.uid() and (role = 'super' or company_id = cid)
  )
$$;

create or replace function public.geo_touch() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists geo_campaigns_touch on public.geo_campaigns;
create trigger geo_campaigns_touch before update on public.geo_campaigns
  for each row execute function public.geo_touch();

-- ---------- RLS ----------
alter table public.geo_companies enable row level security;
alter table public.geo_campaigns enable row level security;
alter table public.geo_admins enable row level security;
alter table public.geo_claims enable row level security;
alter table public.geo_events enable row level security;

create policy geo_companies_read on public.geo_companies for select using (true);
create policy geo_companies_insert on public.geo_companies for insert to authenticated with check (public.geo_is_super());
create policy geo_companies_update on public.geo_companies for update to authenticated
  using (public.geo_can_manage(id)) with check (public.geo_can_manage(id));
create policy geo_companies_delete on public.geo_companies for delete to authenticated using (public.geo_is_super());

-- Público: solo campañas activas y vigentes. Admins: todas las de su empresa.
create policy geo_campaigns_read on public.geo_campaigns for select using (
  (active and (starts_at is null or starts_at <= current_date) and (ends_at is null or ends_at >= current_date))
  or public.geo_can_manage(company_id)
);
create policy geo_campaigns_insert on public.geo_campaigns for insert to authenticated with check (public.geo_can_manage(company_id));
create policy geo_campaigns_update on public.geo_campaigns for update to authenticated
  using (public.geo_can_manage(company_id)) with check (public.geo_can_manage(company_id));
create policy geo_campaigns_delete on public.geo_campaigns for delete to authenticated using (public.geo_can_manage(company_id));

create policy geo_admins_read on public.geo_admins for select to authenticated using (user_id = auth.uid() or public.geo_is_super());
create policy geo_admins_delete on public.geo_admins for delete to authenticated using (public.geo_is_super() and user_id <> auth.uid());

create policy geo_claims_read on public.geo_claims for select to authenticated using (public.geo_can_manage(company_id));
create policy geo_events_read on public.geo_events for select to authenticated using (public.geo_can_manage(company_id));
-- Inserciones en claims/events solo vía funciones (abajo), nunca directo.

-- ---------- Funciones públicas (app del cliente) ----------
create or replace function public.geo_track(p_campaign uuid, p_device text, p_type text, p_distance real default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_type not in ('impression', 'open', 'arrive', 'capture', 'cta', 'video') then
    raise exception 'Tipo de evento inválido';
  end if;
  if p_device is null or length(p_device) not between 8 and 64 then
    raise exception 'Dispositivo inválido';
  end if;
  -- Anti-spam: ignora el mismo evento del mismo dispositivo en 30 s
  if exists (
    select 1 from geo_events
    where campaign_id = p_campaign and device_id = p_device and type = p_type
      and created_at > now() - interval '30 seconds'
  ) then
    return;
  end if;
  insert into geo_events (campaign_id, company_id, device_id, type, distance_m)
  select id, company_id, p_device, p_type, p_distance from geo_campaigns where id = p_campaign and active;
end $$;

create or replace function public.geo_claim(p_campaign uuid, p_device text)
returns json language plpgsql security definer set search_path = public as $$
declare
  c geo_campaigns;
  existing geo_claims;
  used int;
  prefix text;
  v_code text;
begin
  if p_device is null or length(p_device) not between 8 and 64 then
    raise exception 'Dispositivo inválido';
  end if;

  -- Bloquea la campaña para respetar el cupo máximo con usuarios simultáneos
  select * into c from geo_campaigns where id = p_campaign for update;
  if not found or not c.active
     or (c.starts_at is not null and c.starts_at > current_date)
     or (c.ends_at is not null and c.ends_at < current_date) then
    raise exception 'Esta promoción ya no está disponible';
  end if;
  if c.type <> 'coupon' then
    raise exception 'Esta campaña no tiene cupón';
  end if;

  select * into existing from geo_claims where campaign_id = p_campaign and device_id = p_device;
  if found then
    return json_build_object(
      'folio', existing.code,
      'promo', case when c.coupon_mode = 'unique' then existing.code else c.code end,
      'status', existing.status, 'repeat', true);
  end if;

  if c.max_claims is not null then
    select count(*) into used from geo_claims where campaign_id = p_campaign;
    if used >= c.max_claims then
      raise exception 'AGOTADO';
    end if;
  end if;

  prefix := left(coalesce(nullif(regexp_replace(upper(c.code), '[^A-Z0-9]', '', 'g'), ''), 'GEO'), 8);
  loop
    v_code := prefix || '-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 5));
    begin
      insert into geo_claims (campaign_id, company_id, device_id, code)
      values (c.id, c.company_id, p_device, v_code);
      exit;
    exception when unique_violation then
      if exists (select 1 from geo_claims where campaign_id = p_campaign and device_id = p_device) then
        raise exception 'Ya reclamaste este premio';
      end if;
      -- choque de código: reintenta con otro
    end;
  end loop;

  insert into geo_events (campaign_id, company_id, device_id, type) values (c.id, c.company_id, p_device, 'claim');

  return json_build_object(
    'folio', v_code,
    'promo', case when c.coupon_mode = 'unique' then v_code else c.code end,
    'status', 'claimed', 'repeat', false,
    'remaining', case when c.max_claims is null then null else c.max_claims - coalesce(used, 0) - 1 end);
end $$;

-- ---------- Funciones de administración ----------
create or replace function public.geo_redeem(p_code text)
returns json language plpgsql security definer set search_path = public as $$
declare
  cl geo_claims;
  t text;
begin
  if auth.uid() is null then raise exception 'Inicia sesión'; end if;
  select * into cl from geo_claims where upper(code) = upper(trim(p_code)) for update;
  if not found then raise exception 'Código no encontrado'; end if;
  if not geo_can_manage(cl.company_id) then raise exception 'Este código es de otra empresa'; end if;
  select title into t from geo_campaigns where id = cl.campaign_id;
  if cl.status = 'redeemed' then
    return json_build_object('ok', false, 'already', true, 'title', t, 'redeemed_at', cl.redeemed_at);
  end if;
  update geo_claims set status = 'redeemed', redeemed_at = now(), redeemed_by = auth.uid() where id = cl.id;
  insert into geo_events (campaign_id, company_id, device_id, type) values (cl.campaign_id, cl.company_id, cl.device_id, 'redeem');
  return json_build_object('ok', true, 'already', false, 'title', t, 'claimed_at', cl.claimed_at);
end $$;

create or replace function public.geo_campaign_stats(p_company uuid, p_days int default 30)
returns table (
  campaign_id uuid, title text, active boolean,
  impressions bigint, opens bigint, arrivals bigint, captures bigint,
  claims bigint, redeemed bigint, ctas bigint, videos bigint, devices bigint
) language plpgsql stable security definer set search_path = public as $$
begin
  if not geo_can_manage(p_company) then raise exception 'Sin permiso'; end if;
  return query
  select c.id, c.title, c.active,
    count(e.id) filter (where e.type = 'impression'),
    count(e.id) filter (where e.type = 'open'),
    count(e.id) filter (where e.type = 'arrive'),
    count(e.id) filter (where e.type = 'capture'),
    count(e.id) filter (where e.type = 'claim'),
    count(e.id) filter (where e.type = 'redeem'),
    count(e.id) filter (where e.type = 'cta'),
    count(e.id) filter (where e.type = 'video'),
    count(distinct e.device_id)
  from geo_campaigns c
  left join geo_events e on e.campaign_id = c.id and e.created_at >= now() - make_interval(days => p_days)
  where c.company_id = p_company
  group by c.id, c.title, c.active
  order by c.created_at;
end $$;

create or replace function public.geo_daily_stats(p_company uuid, p_days int default 30)
returns table (day date, type text, n bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not geo_can_manage(p_company) then raise exception 'Sin permiso'; end if;
  return query
  select (e.created_at at time zone 'utc')::date, e.type, count(*)
  from geo_events e
  where e.company_id = p_company and e.created_at >= now() - make_interval(days => p_days)
  group by 1, 2
  order by 1, 2;
end $$;

-- El primer usuario que lo llame se vuelve superadministrador (solo funciona una vez)
create or replace function public.geo_claim_superadmin()
returns text language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Inicia sesión'; end if;
  if exists (select 1 from geo_admins where role = 'super') then
    raise exception 'Ya existe un superadministrador. Pídele acceso.';
  end if;
  insert into geo_admins (user_id, email, role)
  select id, email, 'super' from auth.users where id = auth.uid();
  return 'ok';
end $$;

create or replace function public.geo_add_admin(p_email text, p_role text, p_company uuid default null)
returns text language plpgsql security definer set search_path = public as $$
declare
  uid uuid;
begin
  if not geo_is_super() then raise exception 'Solo el superadministrador puede agregar usuarios'; end if;
  if p_role not in ('super', 'company') then raise exception 'Rol inválido'; end if;
  if p_role = 'company' and p_company is null then raise exception 'Elige una empresa'; end if;
  select id into uid from auth.users where lower(email) = lower(trim(p_email));
  if uid is null then raise exception 'Ese correo aún no se ha registrado en el panel'; end if;
  insert into geo_admins (user_id, email, role, company_id)
  values (uid, lower(trim(p_email)), p_role, case when p_role = 'super' then null else p_company end)
  on conflict (user_id) do update set role = excluded.role, company_id = excluded.company_id;
  return 'ok';
end $$;

-- ---------- Storage para logos, videos y sonidos ----------
insert into storage.buckets (id, name, public, file_size_limit)
values ('geo-media', 'geo-media', true, 52428800)
on conflict (id) do nothing;

create policy geo_media_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'geo-media' and exists (select 1 from public.geo_admins where user_id = auth.uid()));
create policy geo_media_update on storage.objects for update to authenticated
  using (bucket_id = 'geo-media' and exists (select 1 from public.geo_admins where user_id = auth.uid()));
create policy geo_media_delete on storage.objects for delete to authenticated
  using (bucket_id = 'geo-media' and exists (select 1 from public.geo_admins where user_id = auth.uid()));

-- ---------- Datos de ejemplo ----------
with co as (
  insert into public.geo_companies (name, color)
  select 'Café Demo', '#ff9f1c'
  where not exists (select 1 from public.geo_companies)
  returning id
)
insert into public.geo_campaigns (company_id, title, subtitle, type, discount, code, coupon_mode, description, cta_text, lat, lng, radius)
select id, 'Café gratis', '¡Encontraste el tesoro!', 'coupon', '2x1', 'GEOCAFE', 'unique',
       'Presenta este código en caja.', 'Cómo llegar a la tienda', 19.4326, -99.1332, 20
from co;

commit;
