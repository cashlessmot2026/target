-- GeoAds AR · migración 002: link corto por empresa (#/e/<slug>)
alter table public.geo_companies add column if not exists slug text;
update public.geo_companies
  set slug = trim(both '-' from regexp_replace(lower(translate(name, 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunaeiouun')), '[^a-z0-9]+', '-', 'g'))
  where slug is null;
create unique index if not exists geo_companies_slug_idx on public.geo_companies (slug);
select id, name, slug from public.geo_companies;
