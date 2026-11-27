-- Caia · base de données des demandes
-- À coller dans Supabase : SQL Editor > New query > Run.
-- Remplacez TON-EMAIL@exemple.fr (en bas) par l'e-mail de chaque membre de l'équipe.

create table if not exists public.demandes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  statut text not null default 'nouveau',
  notes text not null default '',
  soucis text, probleme text, type_commerce text, deja_en_place text, delai text,
  prenom text, nom text, commerce text, ville text, telephone text, email text, creneau text,
  pistes text, estimation_mois integer, appels integer, panier integer, plateformes integer, clients integer,
  detail jsonb,
  source text,          -- d'où vient le commerçant (vide = diagnostic du site)
  rappel_le timestamptz, -- date et heure de rappel programmées
  supprime_le timestamptz -- rempli quand la fiche est dans la corbeille
);

-- Liste des personnes autorisées à voir les demandes
create table if not exists public.equipe (email text primary key);

-- Already created the table before? This adds the new column without touching your data.
alter table public.demandes add column if not exists detail jsonb;
alter table public.demandes add column if not exists source text;
alter table public.demandes add column if not exists rappel_le timestamptz;
alter table public.demandes add column if not exists supprime_le timestamptz;

alter table public.demandes enable row level security;
alter table public.equipe enable row level security;

-- Le formulaire public peut seulement AJOUTER une demande (jamais lire, modifier ni supprimer)
drop policy if exists "formulaire public : ajout" on public.demandes;
create policy "formulaire public : ajout" on public.demandes for insert to anon
  with check (statut = 'nouveau' and notes = '' and rappel_le is null and supprime_le is null and char_length(coalesce(probleme, '')) <= 1000 and char_length(coalesce(telephone, '')) <= 30);

-- Seuls les membres de l'équipe connectés peuvent lire et modifier
drop policy if exists "équipe : lecture" on public.demandes;
create policy "équipe : lecture" on public.demandes for select to authenticated
  using (exists (select 1 from public.equipe e where lower(e.email) = lower(auth.jwt() ->> 'email')));
drop policy if exists "équipe : modification" on public.demandes;
create policy "équipe : modification" on public.demandes for update to authenticated
  using (exists (select 1 from public.equipe e where lower(e.email) = lower(auth.jwt() ->> 'email')))
  with check (exists (select 1 from public.equipe e where lower(e.email) = lower(auth.jwt() ->> 'email')));
-- L'équipe peut aussi ajouter un commerçant à la main et vider la corbeille
drop policy if exists "équipe : ajout" on public.demandes;
create policy "équipe : ajout" on public.demandes for insert to authenticated
  with check (exists (select 1 from public.equipe e where lower(e.email) = lower(auth.jwt() ->> 'email')));
drop policy if exists "équipe : suppression" on public.demandes;
create policy "équipe : suppression" on public.demandes for delete to authenticated
  using (exists (select 1 from public.equipe e where lower(e.email) = lower(auth.jwt() ->> 'email')));
drop policy if exists "équipe : se voir" on public.equipe;
create policy "équipe : se voir" on public.equipe for select to authenticated
  using (lower(email) = lower(auth.jwt() ->> 'email'));

grant insert on public.demandes to anon;
grant select, insert, update, delete on public.demandes to authenticated;
grant select on public.equipe to authenticated;

-- Membres de l'équipe (une ligne par personne)
insert into public.equipe (email) values ('TON-EMAIL@exemple.fr') on conflict do nothing;
