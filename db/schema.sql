-- 스티커 친구 스키마 (Postgres / Neon). 멱등: 여러 번 실행해도 안전합니다.
-- 실행: npm run db:init  (또는 Neon 콘솔 SQL Editor 에 통째로 붙여넣기)
--
-- 보안 구조: 브라우저는 DB에 직접 접속하지 않습니다. 서버(API 라우트)만 DATABASE_URL 로 접속하고,
-- 로그인한 부모의 profile id / 아이 코드를 함수 인자로 넘겨 이 함수들이 모든 판정을 합니다.

-- ───────────────────────── 테이블 ─────────────────────────

create table if not exists public.families (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 40),
  timezone    text not null default 'Asia/Seoul',
  board_size  int  not null default 30 check (board_size between 1 and 200),
  created_at  timestamptz not null default now()
);

create table if not exists public.profiles (
  id             uuid primary key default gen_random_uuid(),
  family_id      uuid not null references public.families(id) on delete cascade,
  role           text not null check (role in ('mom', 'dad')),
  login_id       text not null check (login_id ~ '^[a-z0-9]{2,20}$'),
  password_hash  text not null,
  created_at     timestamptz not null default now()
);
create unique index if not exists profiles_family_role_uq on public.profiles (family_id, role);
create unique index if not exists profiles_login_id_uq on public.profiles (login_id);
create index if not exists profiles_family_idx on public.profiles (family_id);

create table if not exists public.themes (
  id        text primary key,
  name      text not null,
  emoji     text not null,
  sort_no   int  not null default 0
);
insert into public.themes (id, name, emoji, sort_no) values
  ('dino',    '공룡',     '🦖', 1),
  ('space',   '우주',     '🚀', 2),
  ('animals', '동물친구', '🐻', 3),
  ('dessert', '디저트',   '🍰', 4),
  ('car',     '자동차',   '🚗', 5),
  ('unicorn', '유니콘',   '🦄', 6)
on conflict (id) do update set name = excluded.name, emoji = excluded.emoji, sort_no = excluded.sort_no;

create table if not exists public.kids (
  id               uuid primary key default gen_random_uuid(),
  family_id        uuid not null references public.families(id) on delete cascade,
  name             text not null check (char_length(name) between 1 and 20),
  avatar           text not null default '🐻',
  -- 아이 코드: 6자, 헷갈리는 글자(I, L, O, 0, 1) 제외
  view_token       text not null unique check (view_token ~ '^[A-HJ-KM-NP-Z2-9]{6}$'),
  current_board_id uuid,
  created_at       timestamptz not null default now()
);
create index if not exists kids_family_idx on public.kids (family_id);

create table if not exists public.boards (
  id            uuid primary key default gen_random_uuid(),
  kid_id        uuid not null references public.kids(id) on delete cascade,
  theme_id      text not null references public.themes(id),
  board_no      int  not null default 1,
  size          int  not null default 30,
  status        text not null default 'active' check (status in ('active', 'completed')),
  completed_at  timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists boards_kid_idx on public.boards (kid_id);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'kids_current_board_fk') then
    alter table public.kids
      add constraint kids_current_board_fk
      foreign key (current_board_id) references public.boards(id) on delete set null;
  end if;
end $$;

create table if not exists public.routines (
  id          uuid primary key default gen_random_uuid(),
  kid_id      uuid not null references public.kids(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 30),
  emoji       text not null default '⭐',
  sort_no     int  not null default 0,
  active      boolean not null default true,   -- 삭제는 비활성화로 처리(과거 기록 보존)
  created_at  timestamptz not null default now()
);
create index if not exists routines_kid_idx on public.routines (kid_id);

create table if not exists public.daily_checks (
  id          uuid primary key default gen_random_uuid(),
  kid_id      uuid not null references public.kids(id) on delete cascade,
  routine_id  uuid not null references public.routines(id) on delete cascade,
  date        date not null,
  done        boolean not null default false,
  updated_at  timestamptz not null default now(),
  unique (routine_id, date)
);
create index if not exists daily_checks_kid_date_idx on public.daily_checks (kid_id, date);

create table if not exists public.submissions (
  id          uuid primary key default gen_random_uuid(),
  kid_id      uuid not null references public.kids(id) on delete cascade,
  date        date not null,
  status      text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  note        text,
  decided_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  decided_at  timestamptz
);
create unique index if not exists submissions_kid_date_active_uq
  on public.submissions (kid_id, date) where status in ('pending', 'approved');
create index if not exists submissions_kid_idx on public.submissions (kid_id, created_at desc);

create table if not exists public.stickers (
  id             uuid primary key default gen_random_uuid(),
  kid_id         uuid not null references public.kids(id) on delete cascade,
  board_id       uuid not null references public.boards(id) on delete cascade,
  slot_no        int  not null check (slot_no >= 1),
  kind           text not null check (kind in ('routine', 'bonus')),
  date           date not null,
  note           text,
  awarded_by     uuid references public.profiles(id) on delete set null,
  awarded_role   text check (awarded_role in ('mom', 'dad')),
  submission_id  uuid references public.submissions(id) on delete set null,
  value_amount   numeric,                       -- 나중에 금액 부여용(지금은 NULL)
  created_at     timestamptz not null default now(),
  unique (board_id, slot_no)
);
create unique index if not exists stickers_routine_day_uq
  on public.stickers (kid_id, date) where kind = 'routine';
create index if not exists stickers_kid_idx on public.stickers (kid_id);

create table if not exists public.coupons (
  id            uuid primary key default gen_random_uuid(),
  kid_id        uuid not null references public.kids(id) on delete cascade,
  board_id      uuid references public.boards(id) on delete set null,
  title         text not null default '장난감 쿠폰',
  value_amount  numeric,                        -- 나중에 금액 부여용(지금은 NULL)
  used_at       timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists coupons_kid_idx on public.coupons (kid_id);

-- ───────────────────────── 한도 트리거 ─────────────────────────
-- 가족 최대 5개, 가족당 아이 최대 2명. advisory lock 으로 동시 요청도 막습니다.

create or replace function public.enforce_family_limit() returns trigger
language plpgsql as $$
begin
  perform pg_advisory_xact_lock(hashtext('sticker_pal_families_limit'));
  if (select count(*) from public.families) >= 5 then
    raise exception 'family_limit_reached' using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists families_limit on public.families;
create trigger families_limit before insert on public.families
  for each row execute function public.enforce_family_limit();

create or replace function public.enforce_kid_limit() returns trigger
language plpgsql as $$
begin
  perform pg_advisory_xact_lock(hashtext('sticker_pal_kids_' || new.family_id::text));
  if (select count(*) from public.kids where family_id = new.family_id) >= 2 then
    raise exception 'kid_limit_reached' using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists kids_limit on public.kids;
create trigger kids_limit before insert on public.kids
  for each row execute function public.enforce_kid_limit();

-- ───────────────────────── 내부 도우미 ─────────────────────────

create or replace function public._profile(p_profile uuid) returns public.profiles
language plpgsql stable as $$
declare me public.profiles;
begin
  select * into me from public.profiles where id = p_profile;
  if not found then raise exception 'not_parent'; end if;
  return me;
end $$;

create or replace function public.kid_today(p_kid uuid) returns date
language sql stable as $$
  select (now() at time zone f.timezone)::date
  from public.kids k join public.families f on f.id = k.family_id
  where k.id = p_kid
$$;

create or replace function public.gen_kid_code() returns text
language plpgsql as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code text;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.kids where view_token = code);
  end loop;
  return code;
end $$;

-- 아이 + 기본 루틴 3개 생성
create or replace function public._create_kid(p_family uuid, p_name text) returns uuid
language plpgsql as $$
declare kid uuid;
begin
  insert into public.kids (family_id, name, view_token)
  values (p_family, p_name, public.gen_kid_code())
  returning id into kid;
  insert into public.routines (kid_id, name, emoji, sort_no) values
    (kid, '이 닦기', '🦷', 1),
    (kid, '장난감 정리', '🧸', 2),
    (kid, '책 읽기', '📚', 3);
  return kid;
end $$;

-- 스티커 한 개 붙이기(판이 차면 쿠폰 발급 + 판 종료)
create or replace function public._award_sticker(
  p_kid uuid, p_kind text, p_date date, p_note text,
  p_sub uuid, p_profile uuid, p_role text
) returns jsonb
language plpgsql as $$
declare k public.kids; b public.boards; slot int; is_full boolean := false;
begin
  select * into k from public.kids where id = p_kid for update;
  if k.current_board_id is null then raise exception 'no_board'; end if;
  select * into b from public.boards where id = k.current_board_id for update;
  select coalesce(max(slot_no), 0) + 1 into slot from public.stickers where board_id = b.id;
  if slot > b.size then raise exception 'board_full'; end if;

  insert into public.stickers (kid_id, board_id, slot_no, kind, date, note, awarded_by, awarded_role, submission_id)
  values (k.id, b.id, slot, p_kind, p_date, nullif(trim(p_note), ''), p_profile, p_role, p_sub);

  if slot = b.size then
    update public.boards set status = 'completed', completed_at = now() where id = b.id;
    insert into public.coupons (kid_id, board_id) values (k.id, b.id);
    update public.kids set current_board_id = null where id = k.id;
    is_full := true;
  end if;
  return jsonb_build_object('slot', slot, 'coupon', is_full);
end $$;

-- ───────────────────────── 아이 화면 데이터 ─────────────────────────

create or replace function public._kid_view(p_kid uuid) returns jsonb
language plpgsql as $$
declare k public.kids; today date; b public.boards; res jsonb;
begin
  select * into k from public.kids where id = p_kid;
  today := public.kid_today(k.id);
  if k.current_board_id is not null then
    select * into b from public.boards where id = k.current_board_id;
  end if;

  res := jsonb_build_object(
    'kid', jsonb_build_object('name', k.name, 'avatar', k.avatar),
    'today', today,
    'needsTheme', k.current_board_id is null,
    'routines', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', r.id, 'name', r.name, 'emoji', r.emoji, 'done', coalesce(dc.done, false)
      ) order by r.sort_no, r.created_at), '[]'::jsonb)
      from public.routines r
      left join public.daily_checks dc on dc.routine_id = r.id and dc.date = today
      where r.kid_id = k.id and r.active
    ),
    'submission', (
      select jsonb_build_object('status', s.status, 'note', s.note)
      from public.submissions s
      where s.kid_id = k.id and s.date = today
      order by s.created_at desc limit 1
    ),
    'board', case when b.id is null then null else jsonb_build_object(
      'themeId', b.theme_id, 'size', b.size, 'boardNo', b.board_no
    ) end,
    'stickers', case when b.id is null then '[]'::jsonb else (
      select coalesce(jsonb_agg(jsonb_build_object(
        'slot', st.slot_no, 'kind', st.kind, 'role', st.awarded_role,
        'note', st.note, 'date', st.date
      ) order by st.slot_no), '[]'::jsonb)
      from public.stickers st where st.board_id = b.id
    ) end,
    'coupons', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', c.id, 'title', c.title, 'used', c.used_at is not null
      ) order by c.created_at desc), '[]'::jsonb)
      from public.coupons c where c.kid_id = k.id
    ),
    -- 가장 최근에 받은 스티커(판이 끝나 비워져도 남음). 아이 화면이 새 스티커를 알아채는 데 씁니다.
    'lastSticker', (
      select jsonb_build_object('id', st.id, 'slot', st.slot_no, 'kind', st.kind,
                                'role', st.awarded_role, 'note', st.note)
      from public.stickers st where st.kid_id = k.id
      order by st.created_at desc limit 1
    )
  );
  return res;
end $$;

create or replace function public.kid_view(p_token text) returns jsonb
language plpgsql as $$
declare k public.kids;
begin
  select * into k from public.kids where view_token = upper(trim(p_token));
  if not found then raise exception 'invalid_code'; end if;
  return public._kid_view(k.id);
end $$;

create or replace function public.kid_toggle(p_token text, p_routine uuid, p_done boolean) returns jsonb
language plpgsql as $$
declare k public.kids; today date; total int; done_cnt int;
begin
  select * into k from public.kids where view_token = upper(trim(p_token)) for update;
  if not found then raise exception 'invalid_code'; end if;
  if k.current_board_id is null then raise exception 'pick_theme_first'; end if;
  if not exists (select 1 from public.routines where id = p_routine and kid_id = k.id and active) then
    raise exception 'invalid_routine';
  end if;
  today := public.kid_today(k.id);

  -- 승인 대기 중이거나 오늘 이미 승인됐다면 잠금
  if exists (select 1 from public.submissions
             where kid_id = k.id and date = today and status in ('pending', 'approved')) then
    raise exception 'locked';
  end if;

  insert into public.daily_checks (kid_id, routine_id, date, done)
  values (k.id, p_routine, today, p_done)
  on conflict (routine_id, date) do update set done = excluded.done, updated_at = now();

  select count(*) into total from public.routines where kid_id = k.id and active;
  select count(*) into done_cnt
  from public.daily_checks dc join public.routines r on r.id = dc.routine_id
  where dc.kid_id = k.id and dc.date = today and dc.done and r.active;

  if total > 0 and done_cnt >= total then
    insert into public.submissions (kid_id, date, status) values (k.id, today, 'pending')
    on conflict do nothing;
  end if;
  return public._kid_view(k.id);
end $$;

create or replace function public.kid_pick_theme(p_token text, p_theme text) returns jsonb
language plpgsql as $$
declare k public.kids; bid uuid; no int; sz int;
begin
  select * into k from public.kids where view_token = upper(trim(p_token)) for update;
  if not found then raise exception 'invalid_code'; end if;
  if k.current_board_id is not null then raise exception 'board_in_progress'; end if;
  if not exists (select 1 from public.themes where id = p_theme) then raise exception 'invalid_theme'; end if;
  select coalesce(max(board_no), 0) + 1 into no from public.boards where kid_id = k.id;
  select board_size into sz from public.families where id = k.family_id;
  insert into public.boards (kid_id, theme_id, board_no, size) values (k.id, p_theme, no, sz)
  returning id into bid;
  update public.kids set current_board_id = bid where id = k.id;
  return public._kid_view(k.id);
end $$;

-- ───────────────────────── 부모 함수 (p_profile = 로그인한 부모의 profile id) ─────────────────────────

create or replace function public.approve_submission(p_profile uuid, p_submission uuid) returns jsonb
language plpgsql as $$
declare me public.profiles; s public.submissions; res jsonb;
begin
  me := public._profile(p_profile);
  select * into s from public.submissions where id = p_submission for update;
  if not found then raise exception 'not_found'; end if;
  if not exists (select 1 from public.kids where id = s.kid_id and family_id = me.family_id) then
    raise exception 'forbidden';
  end if;
  if s.status <> 'pending' then raise exception 'not_pending'; end if;

  res := public._award_sticker(s.kid_id, 'routine', s.date, null, s.id, me.id, me.role);
  update public.submissions set status = 'approved', decided_by = me.id, decided_at = now() where id = s.id;
  return res;
end $$;

create or replace function public.reject_submission(p_profile uuid, p_submission uuid, p_note text default null) returns void
language plpgsql as $$
declare me public.profiles; s public.submissions;
begin
  me := public._profile(p_profile);
  select * into s from public.submissions where id = p_submission for update;
  if not found then raise exception 'not_found'; end if;
  if not exists (select 1 from public.kids where id = s.kid_id and family_id = me.family_id) then
    raise exception 'forbidden';
  end if;
  if s.status <> 'pending' then raise exception 'not_pending'; end if;

  update public.submissions
     set status = 'rejected', note = nullif(trim(p_note), ''), decided_by = me.id, decided_at = now()
   where id = s.id;
  -- 그날 체크를 초기화해서 다시 할 수 있게 합니다.
  delete from public.daily_checks where kid_id = s.kid_id and date = s.date;
end $$;

create or replace function public.give_bonus_sticker(p_profile uuid, p_kid uuid, p_note text default null) returns jsonb
language plpgsql as $$
declare me public.profiles;
begin
  me := public._profile(p_profile);
  if not exists (select 1 from public.kids where id = p_kid and family_id = me.family_id) then
    raise exception 'forbidden';
  end if;
  return public._award_sticker(p_kid, 'bonus', public.kid_today(p_kid), p_note, null, me.id, me.role);
end $$;

create or replace function public.add_kid(p_profile uuid, p_name text) returns uuid
language plpgsql as $$
declare me public.profiles;
begin
  me := public._profile(p_profile);
  if char_length(trim(p_name)) = 0 then raise exception 'invalid_name'; end if;
  return public._create_kid(me.family_id, trim(p_name));  -- 3번째 아이는 트리거가 막습니다
end $$;

