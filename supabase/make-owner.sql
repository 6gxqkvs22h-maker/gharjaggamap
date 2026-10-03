-- Run this AFTER you have created your user in Supabase > Authentication > Users.
-- Replace the email below with the email you created, then press Run.

insert into public.admins (user_id)
select id from auth.users where email = 'PUT-YOUR-EMAIL-HERE'
on conflict (user_id) do nothing;

-- This should now show one row with your email:
select u.email from public.admins a join auth.users u on u.id = a.user_id;
